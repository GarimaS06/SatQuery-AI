"""Spectral index computation for satellite imagery.

Provides NDVI, NDWI and NDBI functions that accept a ``LoadedImage``
and return a structured ``AnalysisResult`` with statistics, evidence
and a saved colour-mapped PNG.
"""

import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

from person_b.band_loader import LoadedImage, get_band
from person_b.output_schema import AnalysisResult

# Ensure the shared outputs directory exists.
Path("outputs").mkdir(exist_ok=True)


# ── NDVI ─────────────────────────────────────────────────────────────────────

def compute_ndvi(loaded: LoadedImage) -> AnalysisResult:
    """Compute the Normalized Difference Vegetation Index.

    NDVI = (NIR - RED) / (NIR + RED)

    Requires the ``"red"`` and ``"nir"`` bands.
    """
    red = get_band(loaded, "red")
    nir = get_band(loaded, "nir")

    # Guard: both bands must be present.
    if red is None or nir is None:
        return AnalysisResult(
            success=False,
            analysis_type="ndvi",
            result={},
            evidence={},
            output_files={},
            error="NDVI requires RED and NIR bands. Not available in this image.",
        )

    # Compute index and clip to valid range.
    ndvi = (nir - red) / (nir + red + 1e-8)
    ndvi = np.clip(ndvi, -1.0, 1.0)

    # Statistics.
    mean_value = float(ndvi.mean())
    min_value = float(ndvi.min())
    max_value = float(ndvi.max())

    # Evidence: percentage of pixels with healthy vegetation (NDVI > 0.3).
    vegetation_percentage = float((ndvi > 0.3).mean() * 100)

    # Save colourised map.
    map_path = "outputs/ndvi_map.png"
    plt.figure(figsize=(8, 6))
    plt.imshow(ndvi, cmap="RdYlGn", vmin=-1, vmax=1)
    plt.colorbar(label="NDVI")
    plt.title("NDVI — Normalized Difference Vegetation Index")
    plt.axis("off")
    plt.savefig(map_path, dpi=150, bbox_inches="tight")
    plt.close()

    return AnalysisResult(
        success=True,
        analysis_type="ndvi",
        result={"mean_value": mean_value, "min_value": min_value, "max_value": max_value},
        evidence={"vegetation_percentage": round(vegetation_percentage, 2)},
        output_files={"map": map_path},
    )


# ── NDWI ─────────────────────────────────────────────────────────────────────

def compute_ndwi(loaded: LoadedImage) -> AnalysisResult:
    """Compute the Normalized Difference Water Index.

    NDWI = (GREEN - NIR) / (GREEN + NIR)

    Requires the ``"green"`` and ``"nir"`` bands.
    """
    green = get_band(loaded, "green")
    nir = get_band(loaded, "nir")

    if green is None or nir is None:
        return AnalysisResult(
            success=False,
            analysis_type="ndwi",
            result={},
            evidence={},
            output_files={},
            error="NDWI requires GREEN and NIR bands. Not available in this image.",
        )

    ndwi = (green - nir) / (green + nir + 1e-8)
    ndwi = np.clip(ndwi, -1.0, 1.0)

    mean_value = float(ndwi.mean())
    min_value = float(ndwi.min())
    max_value = float(ndwi.max())

    # Evidence: percentage of pixels likely representing water (NDWI > 0.3).
    water_percentage = float((ndwi > 0.3).mean() * 100)

    map_path = "outputs/ndwi_map.png"
    plt.figure(figsize=(8, 6))
    plt.imshow(ndwi, cmap="Blues", vmin=-1, vmax=1)
    plt.colorbar(label="NDWI")
    plt.title("NDWI — Normalized Difference Water Index")
    plt.axis("off")
    plt.savefig(map_path, dpi=150, bbox_inches="tight")
    plt.close()

    return AnalysisResult(
        success=True,
        analysis_type="ndwi",
        result={"mean_value": mean_value, "min_value": min_value, "max_value": max_value},
        evidence={"water_percentage": round(water_percentage, 2)},
        output_files={"map": map_path},
    )


# ── NDBI ─────────────────────────────────────────────────────────────────────

def compute_ndbi(loaded: LoadedImage) -> AnalysisResult:
    """Compute the Normalized Difference Built-up Index.

    NDBI = (SWIR - NIR) / (SWIR + NIR)

    Requires the ``"swir"`` and ``"nir"`` bands.
    """
    swir = get_band(loaded, "swir")
    nir = get_band(loaded, "nir")

    if swir is None or nir is None:
        return AnalysisResult(
            success=False,
            analysis_type="ndbi",
            result={},
            evidence={},
            output_files={},
            error="NDBI requires SWIR and NIR bands. Not available in this image.",
        )

    ndbi = (swir - nir) / (swir + nir + 1e-8)
    ndbi = np.clip(ndbi, -1.0, 1.0)

    mean_value = float(ndbi.mean())
    min_value = float(ndbi.min())
    max_value = float(ndbi.max())

    # Evidence: percentage of pixels likely representing built-up area (NDBI > 0.1).
    urban_percentage = float((ndbi > 0.1).mean() * 100)

    map_path = "outputs/ndbi_map.png"
    plt.figure(figsize=(8, 6))
    plt.imshow(ndbi, cmap="OrRd", vmin=-1, vmax=1)
    plt.colorbar(label="NDBI")
    plt.title("NDBI — Normalized Difference Built-up Index")
    plt.axis("off")
    plt.savefig(map_path, dpi=150, bbox_inches="tight")
    plt.close()

    return AnalysisResult(
        success=True,
        analysis_type="ndbi",
        result={"mean_value": mean_value, "min_value": min_value, "max_value": max_value},
        evidence={"urban_percentage": round(urban_percentage, 2)},
        output_files={"map": map_path},
    )

