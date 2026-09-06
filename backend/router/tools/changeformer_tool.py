from ..domain.enums import TaskType
from ..domain.models import ToolParameters
from ..schemas.response import ToolResult
from .analysis_result_mapper import map_analysis_result
from .loading import get_loaded_image


def _extract_rgb(loaded_image):
    """
    Extract an (H, W, 3) float32 RGB array from a LoadedImage.

    Raises ValueError if any of the required bands (red, green, blue)
    are missing from the loaded image's band_indices.
    """
    required = ("red", "green", "blue")
    missing = [
        band for band in required
        if band not in loaded_image.band_indices
    ]
    if missing:
        raise ValueError(
            f"Image is missing required RGB bands: {missing}"
        )

    red = loaded_image.band_indices["red"]
    green = loaded_image.band_indices["green"]
    blue = loaded_image.band_indices["blue"]

    return loaded_image.array[
        [red, green, blue], :, :
    ].transpose(1, 2, 0)


class ChangeFormerTool:
    name = TaskType.CHANGEFORMER

    def run(self, params: ToolParameters) -> ToolResult:
        if not params.image2_path:
            return ToolResult(
                tool=self.name.value,
                success=False,
                error="CHANGEFORMER requires a second image.",
            )

        try:
            before_loaded = get_loaded_image(params.image_path)
            after_loaded = get_loaded_image(params.image2_path)

            before = _extract_rgb(before_loaded)
            after = _extract_rgb(after_loaded)

            from person_b.image_alignment import align_images
            from person_b.changeformer_tool import run_changeformer

            alignment = align_images(before, after)
            aligned_after = alignment["aligned_after"]

            analysis = run_changeformer(
                before,
                aligned_after,
                pixel_size_m=before_loaded.pixel_size_m,
            )

            if alignment.get("warning"):
                analysis.warnings.append(alignment["warning"])

            analysis.evidence["alignment"] = {
                "ssim_before": alignment.get("ssim_before"),
                "ssim_after": alignment.get("ssim_after"),
                "registration_applied": alignment.get(
                    "registration_applied"
                ),
                "alignment_quality": alignment.get(
                    "alignment_quality"
                ),
            }

            return map_analysis_result(
                analysis,
                self.name.value,
            )

        except Exception as exc:
            return ToolResult(
                tool=self.name.value,
                success=False,
                error=str(exc),
            )

