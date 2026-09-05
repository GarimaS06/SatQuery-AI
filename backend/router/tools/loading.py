from pathlib import Path

from person_b.band_loader import load_image


def get_loaded_image(image_path: str):
    """
    Load a satellite image using Person B's band loader.

    This is the centralized loading entry point for
    NDVI, NDWI, and NDBI tools.
    """

    path = Path(image_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Image file not found: {image_path}"
        )

    if not path.is_file():
        raise ValueError(
            f"Image path is not a file: {image_path}"
        )

    return load_image(str(path))