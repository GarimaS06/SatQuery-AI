"""Stack separate single-band GeoTIFF files into one multiband GeoTIFF.

Typical use-case: Landsat or Sentinel products that ship one file per
spectral band need to be combined before ``band_loader.load_image()``
can assign band names and enable NDVI / NDWI computation.
"""

import os

import rasterio


def stack_bands(band_file_map: dict, output_path: str) -> str:
    """Stack individual band files into a single multiband GeoTIFF.

    Parameters
    ----------
    band_file_map : dict
        Mapping of band names to file paths, e.g.
        ``{"red": "path/to/band4.tif", "nir": "path/to/band5.tif"}``.
        The key order determines the band order in the output file.
    output_path : str
        Path where the stacked GeoTIFF will be saved.

    Returns
    -------
    str
        The *output_path* that was written.

    Raises
    ------
    ValueError
        If any input file has a different CRS, width, height or
        transform than the first file.
    """
    band_names = list(band_file_map.keys())
    band_paths = list(band_file_map.values())
    n_bands = len(band_names)

    if n_bands == 0:
        raise ValueError("band_file_map is empty. Provide at least one band.")

    # ── read reference metadata from the first band file ─────────────
    with rasterio.open(band_paths[0]) as ref:
        ref_crs = ref.crs
        ref_width = ref.width
        ref_height = ref.height
        ref_transform = ref.transform
        ref_dtype = ref.dtypes[0]
        ref_nodata = ref.nodata

    # ── verify that every other band file matches ────────────────────
    for name, path in zip(band_names[1:], band_paths[1:]):
        with rasterio.open(path) as src:
            if src.crs != ref_crs:
                raise ValueError(
                    f"Band '{name}' CRS ({src.crs}) does not match "
                    f"reference CRS ({ref_crs}).  File: {path}"
                )
            if src.width != ref_width or src.height != ref_height:
                raise ValueError(
                    f"Band '{name}' size ({src.width}x{src.height}) does not "
                    f"match reference size ({ref_width}x{ref_height}).  "
                    f"File: {path}"
                )
            if src.transform != ref_transform:
                raise ValueError(
                    f"Band '{name}' transform does not match the reference "
                    f"transform.  File: {path}"
                )

    # ── create parent directory if needed ─────────────────────────────
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # ── write the stacked GeoTIFF ────────────────────────────────────
    profile = {
        "driver": "GTiff",
        "dtype": ref_dtype,
        "width": ref_width,
        "height": ref_height,
        "count": n_bands,
        "crs": ref_crs,
        "transform": ref_transform,
        "nodata": ref_nodata,
    }

    with rasterio.open(output_path, "w", **profile) as dst:
        for idx, (name, path) in enumerate(zip(band_names, band_paths), start=1):
            with rasterio.open(path) as src:
                # Read the single band and write it as band `idx`.
                dst.write(src.read(1), idx)

            # Store the band name so band_loader can read it later.
            dst.set_band_description(idx, name)

    print(f"Stacked {n_bands} bands into: {output_path}")
    for idx, name in enumerate(band_names, start=1):
        print(f"  Band {idx}: {name}")

    return output_path

