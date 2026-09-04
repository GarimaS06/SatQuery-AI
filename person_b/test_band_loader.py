"""Step 3 – Verify that band_loader.load_image() and get_band() work.

Usage:
    python person_b/test_band_loader.py <path_to_image>

If no path is given, the script prints instructions and exits.
"""

import sys
import os

# Ensure the project root is on the Python path so imports resolve.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from person_b.band_loader import load_image, get_band


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python person_b/test_band_loader.py <path_to_image>")
        print("Provide a GeoTIFF or standard image file to test.")
        sys.exit(1)

    file_path = sys.argv[1]
    print(f"Loading image: {file_path}\n")

    loaded = load_image(file_path)

    # ── 1–5: Array properties ────────────────────────────────────────────
    print("=" * 60)
    print("IMAGE ARRAY PROPERTIES")
    print("=" * 60)
    print(f"  1. Array shape        : {loaded.array.shape}")
    print(f"  2. Number of bands    : {loaded.n_bands}")
    print(f"  3. Height             : {loaded.height}")
    print(f"     Width              : {loaded.width}")
    print(f"  4. Array dtype        : {loaded.array.dtype}")
    print(f"  5. Min normalised val : {loaded.array.min():.6f}")
    print(f"     Max normalised val : {loaded.array.max():.6f}")

    # ── 6–8: Spatial / sensor metadata ───────────────────────────────────
    print()
    print("=" * 60)
    print("SPATIAL / SENSOR METADATA")
    print("=" * 60)
    print(f"  6. CRS                : {loaded.crs}")
    print(f"  7. Pixel size (m)     : {loaded.pixel_size_m}")
    print(f"  8. Sensor hint        : {loaded.sensor_hint}")

    # ── 9: Band indices ──────────────────────────────────────────────────
    print(f"  9. Band indices       : {loaded.band_indices}")

    # ── 10: Warnings ─────────────────────────────────────────────────────
    print()
    print("=" * 60)
    print("WARNINGS")
    print("=" * 60)
    if loaded.warnings:
        for i, w in enumerate(loaded.warnings, 1):
            print(f"  {i}. {w}")
    else:
        print("  (none)")

    # ── 11–14: Band availability ─────────────────────────────────────────
    print()
    print("=" * 60)
    print("BAND AVAILABILITY")
    print("=" * 60)
    for band_name in ("red", "green", "blue", "nir"):
        band = get_band(loaded, band_name)
        available = band is not None
        label = {
            "red": "11", "green": "12", "blue": "13", "nir": "14",
        }[band_name]
        print(f"  {label}. {band_name:6s} available : {available}")
        if available:
            print(f"       shape : {band.shape}")
            print(f"       dtype : {band.dtype}")
            print(f"       min   : {band.min():.6f}")
            print(f"       max   : {band.max():.6f}")

    # ── Summary: NDVI readiness ──────────────────────────────────────────
    has_nir = get_band(loaded, "nir") is not None
    has_red = get_band(loaded, "red") is not None

    print()
    print("=" * 60)
    print("NDVI READINESS CHECK")
    print("=" * 60)
    print(f"  'nir' band available? : {'Yes' if has_nir else 'No'}")
    print(f"  'red' band available? : {'Yes' if has_red else 'No'}")
    if has_nir and has_red:
        print("  >> compute_ndvi() CAN run on this image.")
    else:
        missing = []
        if not has_nir:
            missing.append("nir")
        if not has_red:
            missing.append("red")
        print(f"  >> compute_ndvi() CANNOT run. Missing band(s): {', '.join(missing)}")
        print("    To fix: provide a multispectral satellite image")
        print("    (e.g. Sentinel-2 or Landsat 8 GeoTIFF) that")
        print("    contains at least RED and NIR bands.")


if __name__ == "__main__":
    main()
