from ..domain.enums import TaskType
from ..domain.models import ToolParameters
from ..schemas.response import ToolResult
from .analysis_result_mapper import map_analysis_result
from .loading import get_loaded_image


class NDWITool:
    name = TaskType.NDWI

    def run(self, params: ToolParameters) -> ToolResult:
        try:
            loaded = get_loaded_image(params.image_path)

            from person_b.spectral_indices import compute_ndwi

            analysis = compute_ndwi(loaded)

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