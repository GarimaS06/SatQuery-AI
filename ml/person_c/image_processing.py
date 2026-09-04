"""Input validation owned by Person C, before GeoChat-specific processing."""

from __future__ import annotations

from pathlib import Path
from typing import Union

from PIL import Image, UnidentifiedImageError

from .types import ImagePreparation

ImageInput = Union[str, Path, Image.Image]
MAX_INPUT_DIMENSION = 2048


class ImageValidationError(ValueError):
    """Raised when an image does not meet the current Person A contract."""


def prepare_image(image_input: ImageInput) -> ImagePreparation:
    """Decode, constrain, and convert a Person A image without enlargement.

    The returned PIL image has not undergone GeoChat's 504-pixel padding and
    normalization. That model-specific operation belongs in the real adapter.
    """

    image = _load_image(image_input)
    source_width, source_height = image.size
    if source_width < 1 or source_height < 1:
        raise ImageValidationError("Image dimensions must be positive.")

    converted_to_rgb = image.mode != "RGB"
    if converted_to_rgb:
        image = image.convert("RGB")

    was_resized = source_width > MAX_INPUT_DIMENSION or source_height > MAX_INPUT_DIMENSION
    warnings: list[str] = []
    if was_resized:
        image.thumbnail((MAX_INPUT_DIMENSION, MAX_INPUT_DIMENSION), Image.Resampling.LANCZOS)
        warnings.append(
            f"Image exceeded {MAX_INPUT_DIMENSION} px and was downscaled without changing aspect ratio."
        )

    return ImagePreparation(
        image=image,
        source_width=source_width,
        source_height=source_height,
        width=image.width,
        height=image.height,
        converted_to_rgb=converted_to_rgb,
        was_resized=was_resized,
        warnings=warnings,
    )


def _load_image(image_input: ImageInput) -> Image.Image:
    if isinstance(image_input, Image.Image):
        image_input.load()
        return image_input.copy()

    if not isinstance(image_input, (str, Path)):
        raise ImageValidationError("image_input must be a path or PIL.Image.Image.")

    path = Path(image_input)
    if not path.is_file():
        raise ImageValidationError(f"Image path does not exist or is not a file: {path}")
    if path.suffix.lower() != ".png":
        raise ImageValidationError("Person C currently accepts PNG image paths from Person A.")

    try:
        with Image.open(path) as opened:
            opened.load()
            return opened.copy()
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageValidationError(f"Could not decode PNG image: {path.name}") from exc
