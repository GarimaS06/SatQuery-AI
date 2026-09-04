"""Band loader for satellite and standard imagery.

Loads a raster image via Rasterio (preferred) or PIL (fallback),
normalises pixel values to float32 in ~0–1, extracts spatial
metadata, and infers a sensor / band mapping.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np


# ── dataclass ────────────────────────────────────────────────────────────────

@dataclass
class LoadedImage:
    """Container returned by ``load_image``."""

    array: np.ndarray            # (bands, H, W), float32, ~0–1
    n_bands: int
    height: int
    width: int
    pixel_size_m: float | None   # ground sample distance in metres
    crs: str | None              # coordinate-reference-system string
    sensor_hint: str             # sentinel2 | landsat8 | rgb_nir | rgb | unknown
    band_indices: dict           # e.g. {"red": 0, "green": 1, ...}
    warnings: list = field(default_factory=list)


# ── internal: band-description parsing ───────────────────────────────────────

# Keywords we look for inside Rasterio band descriptions.
_BAND_KEYWORDS: dict[str, str] = {
    "blue":                "blue",
    "green":               "green",
    "red":                 "red",
    "nir":                 "nir",
    "near infrared":       "nir",
    "near-infrared":       "nir",
    "swir":                "swir",
    "shortwave infrared":  "swir",
    "short-wave infrared": "swir",
}


def _try_parse_descriptions(descriptions: tuple) -> dict | None:
    """Build a band_indices dict from Rasterio band descriptions.

    Returns a mapping like ``{"red": 0, "green": 1, ...}`` when the
    descriptions contain at least *red*, *green* and *blue*.
    Returns ``None`` otherwise so the caller can fall back to the
    band-count heuristic.
    """
    if not descriptions or all(d is None for d in descriptions):
        return None

    mapping: dict[str, int] = {}
    for idx, desc in enumerate(descriptions):
        if desc is None:
            continue
        lower = desc.strip().lower()
        for keyword, band_name in _BAND_KEYWORDS.items():
            if keyword in lower and band_name not in mapping:
                mapping[band_name] = idx
                break

    # Accept only when at least the three visible bands are identified.
    if all(name in mapping for name in ("red", "green", "blue")):
        return mapping
    return None


# ── internal: default band mapping by count ──────────────────────────────────

def _default_band_mapping(n_bands: int, warnings: list) -> tuple[str, dict]:
    """Return ``(sensor_hint, band_indices)`` using band-count heuristics."""

    if n_bands == 13:
        warnings.append(
            "Assuming Sentinel-2 band ordering (13 bands). "
            "Verify against source metadata."
        )
        return "sentinel2", {
            "blue": 1, "green": 2, "red": 3, "nir": 7, "swir": 10,
        }

    if n_bands == 11:
        warnings.append(
            "Assuming Landsat 8 band ordering (11 bands). "
            "Verify against source metadata."
        )
        return "landsat8", {
            "blue": 1, "green": 2, "red": 3, "nir": 4, "swir": 5,
        }

    if n_bands == 4:
        return "rgb_nir", {
            "red": 0, "green": 1, "blue": 2, "nir": 3,
        }

    if n_bands == 3:
        return "rgb", {"red": 0, "green": 1, "blue": 2}

    warnings.append(
        f"Unrecognised band count ({n_bands}). "
        "Cannot determine sensor type or band mapping."
    )
    return "unknown", {}


# ── internal: normalisation ──────────────────────────────────────────────────

def _normalize_array(
    array: np.ndarray,
    dtype_name: str,
    scales: tuple | None,
    offsets: tuple | None,
    nodata,
    warnings: list,
) -> np.ndarray:
    """Normalise raw band data to float32 in approximately 0–1.

    The *same* factor is applied to every band so that relative
    band relationships (needed for NDVI etc.) are preserved.
    """
    arr = array.astype(np.float32)

    # ---- mark NoData as NaN ----
    if nodata is not None:
        arr[arr == nodata] = np.nan

    # ---- apply scale / offset when the dataset provides non-trivial ones ----
    has_scale = scales is not None and any(s != 1.0 for s in scales)
    has_offset = offsets is not None and any(o != 0.0 for o in offsets)

    if has_scale or has_offset:
        for b in range(arr.shape[0]):
            s = scales[b] if scales else 1.0
            o = offsets[b] if offsets else 0.0
            arr[b] = arr[b] * s + o

        # After applying scale/offset the values are typically physical
        # reflectance (0–1).  If they already fit, just clip and return.
        valid = arr[np.isfinite(arr)]
        if valid.size > 0 and valid.max() <= 1.5:
            return np.clip(arr, 0.0, 1.0)

    # ---- dtype-aware normalisation (uniform across all bands) ----
    if "uint8" in dtype_name:
        # 0–255 → 0–1
        arr = arr / 255.0

    elif "uint16" in dtype_name or "int16" in dtype_name:
        valid = arr[np.isfinite(arr)]
        if valid.size > 0:
            p99 = float(np.percentile(valid, 99))
            if p99 <= 1.0:
                pass                       # already in 0–1
            elif 8000.0 <= p99 <= 12000.0:
                arr = arr / 10000.0        # standard reflectance × 10 000
            elif p99 <= 255.0:
                arr = arr / 255.0
                warnings.append(
                    "uint16 data with values in 0-255 range; divided by 255."
                )
            else:
                arr = arr / p99
                warnings.append(
                    f"Normalised uint16 data by 99th percentile ({p99:.1f}). "
                    "Verify that normalisation is appropriate."
                )

    elif "float" in dtype_name:
        valid = arr[np.isfinite(arr)]
        if valid.size > 0:
            vmax = float(valid.max())
            if vmax <= 1.5:
                pass                       # already in 0–1
            elif 8000.0 <= vmax <= 12000.0:
                arr = arr / 10000.0
            else:
                p99 = float(np.percentile(valid, 99))
                if p99 > 0:
                    arr = arr / p99
                    warnings.append(
                        f"Normalised float data by 99th percentile ({p99:.1f}). "
                        "Verify that normalisation is appropriate."
                    )
    else:
        # Unknown dtype – last-resort uniform division.
        valid = arr[np.isfinite(arr)]
        if valid.size > 0:
            vmax = float(valid.max())
            if vmax > 1.0:
                arr = arr / vmax
                warnings.append(
                    f"Unknown dtype '{dtype_name}': divided by max ({vmax:.1f})."
                )

    return np.clip(arr, 0.0, 1.0)


# ── internal: pixel size ─────────────────────────────────────────────────────

def _compute_pixel_size(
    transform,
    crs_obj,
    crs_str: str | None,
    height: int,
    warnings: list,
) -> float | None:
    """Return the ground-sample distance in metres (approximate)."""

    if transform is None:
        warnings.append("No geotransform available. Pixel size unknown.")
        return None

    # Pixel size in native CRS units.
    px = abs(transform.a)   # pixel width
    py = abs(transform.e)   # pixel height

    if crs_obj is None or crs_str is None:
        warnings.append("No CRS available. Pixel size unknown.")
        return None

    # Projected CRS – units are already metres (or very close).
    if crs_obj.is_projected:
        return (px + py) / 2.0

    # Geographic CRS – units are degrees; convert at the image centre.
    if crs_obj.is_geographic:
        center_lat = transform.f + transform.e * (height / 2.0)
        m_per_deg_lat = 111_320.0
        m_per_deg_lon = 111_320.0 * math.cos(math.radians(center_lat))

        size_m = (py * m_per_deg_lat + px * m_per_deg_lon) / 2.0
        warnings.append(
            f"Geographic CRS detected. "
            f"Pixel size (~{size_m:.2f} m) is approximate."
        )
        return size_m

    warnings.append("CRS type not recognised. Pixel size unknown.")
    return None


# ── internal: sensor hint from description mapping ───────────────────────────

def _sensor_hint_from_mapping(n_bands: int, mapping: dict) -> str:
    """Decide a sensor_hint when band descriptions were parsed."""
    if n_bands == 13:
        return "sentinel2"
    if n_bands == 11:
        return "landsat8"
    if "nir" in mapping:
        return "rgb_nir"
    if n_bands == 3:
        return "rgb"
    return "unknown"


# ── public API ───────────────────────────────────────────────────────────────

def load_image(file_path: str) -> LoadedImage:
    """Load a satellite or standard image.

    1. Tries **Rasterio** (GeoTIFF and other raster formats).
    2. Falls back to **PIL** for JPG / PNG.
    3. Raises ``RuntimeError`` if both fail.
    """
    warnings: list[str] = []

    # ---- attempt 1: Rasterio ------------------------------------------------
    try:
        import rasterio

        with rasterio.open(file_path) as src:
            # Read every band into a single array.
            array = src.read()  # (bands, H, W)

            n_bands = src.count
            height = src.height
            width = src.width
            dtype_name = src.dtypes[0]

            # Coordinate-reference system.
            crs_obj = src.crs
            crs_str = str(crs_obj) if crs_obj else None

            # Ground-sample distance.
            pixel_size_m = _compute_pixel_size(
                src.transform, crs_obj, crs_str, height, warnings,
            )

            # Normalise pixel values to ~0–1.
            array = _normalize_array(
                array, dtype_name,
                getattr(src, "scales", None),
                getattr(src, "offsets", None),
                src.nodata,
                warnings,
            )

            # Band mapping – prefer descriptions, fall back to band count.
            desc_mapping = _try_parse_descriptions(src.descriptions)

            if desc_mapping is not None:
                sensor_hint = _sensor_hint_from_mapping(n_bands, desc_mapping)
                band_indices = desc_mapping
            else:
                sensor_hint, band_indices = _default_band_mapping(
                    n_bands, warnings,
                )

        return LoadedImage(
            array=array,
            n_bands=n_bands,
            height=height,
            width=width,
            pixel_size_m=pixel_size_m,
            crs=crs_str,
            sensor_hint=sensor_hint,
            band_indices=band_indices,
            warnings=warnings,
        )

    except Exception as rio_err:
        rio_msg = str(rio_err)

    # ---- attempt 2: PIL fallback --------------------------------------------
    try:
        from PIL import Image

        img = Image.open(file_path).convert("RGB")
        arr = np.array(img, dtype=np.float32) / 255.0  # (H, W, 3), 0–1
        arr = arr.transpose(2, 0, 1)                    # (3, H, W)

        warnings.append(
            "Non-GeoTIFF image loaded. No spatial metadata available."
        )

        return LoadedImage(
            array=arr,
            n_bands=3,
            height=arr.shape[1],
            width=arr.shape[2],
            pixel_size_m=None,
            crs=None,
            sensor_hint="rgb",
            band_indices={"red": 0, "green": 1, "blue": 2},
            warnings=warnings,
        )

    except Exception as pil_err:
        pil_msg = str(pil_err)

    # ---- both failed --------------------------------------------------------
    raise RuntimeError(
        f"Could not load image '{file_path}'.\n"
        f"  Rasterio error: {rio_msg}\n"
        f"  PIL error:      {pil_msg}"
    )


def get_band(loaded: LoadedImage, band_name: str) -> np.ndarray | None:
    """Return a single 2-D band array by name, or ``None`` if unavailable.

    >>> nir = get_band(loaded, "nir")  # shape (H, W) or None
    """
    idx = loaded.band_indices.get(band_name)
    if idx is None or idx < 0 or idx >= loaded.n_bands:
        return None
    return loaded.array[idx]

