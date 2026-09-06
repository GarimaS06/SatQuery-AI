from ..domain.enums import TaskType
from ..domain.models import ToolParameters
from ..schemas.response import ToolResult
from .analysis_result_mapper import map_analysis_result
from .loading import get_loaded_image


class ChangeDetectionTool:
    name = TaskType.CHANGE_DETECTION

    def run(self, params: ToolParameters) -> ToolResult:
        if not params.image2_path:
            return ToolResult(
                tool=self.name.value,
                success=False,
                error="CHANGE_DETECTION requires a second image.",
            )

        try:
            before_loaded = get_loaded_image(params.image_path)
            after_loaded = get_loaded_image(params.image2_path)

            red = before_loaded.band_indices["red"]
            green = before_loaded.band_indices["green"]
            blue = before_loaded.band_indices["blue"]

            before = before_loaded.array[
                [red, green, blue], :, :
            ].transpose(1, 2, 0)

            after_red = after_loaded.band_indices["red"]
            after_green = after_loaded.band_indices["green"]
            after_blue = after_loaded.band_indices["blue"]

            after = after_loaded.array[
                [after_red, after_green, after_blue], :, :
            ].transpose(1, 2, 0)

            from person_b.image_alignment import align_images
            from person_b.change_detection import detect_changes

            alignment = align_images(before, after)
            aligned_after = alignment["aligned_after"]

            analysis = detect_changes(
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