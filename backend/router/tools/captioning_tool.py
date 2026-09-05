from ..domain.enums import TaskType
from ..domain.models import ToolParameters
from ..schemas.response import ToolResult

from ml.person_c.captioning import PersonCCaptioningService


class CaptioningTool:
    name = TaskType.CAPTIONING

    def __init__(self):
        self.service = PersonCCaptioningService()

    def run(self, params: ToolParameters) -> ToolResult:
        try:
            result = self.service.caption(
                image=params.image_path,
                metadata=params.extra,
            )

            data = result.to_dict()

            return ToolResult(
                tool=self.name.value,
                success=data.get("status") in {"success", "mock"},
                output={
                    "caption": data.get("caption"),
                    "model_name": data.get("model_name"),
                    "status": data.get("status"),
                    "metadata": data.get("metadata", {}),
                },
                warnings=data.get("warnings", []),
                error=data.get("error"),
            )

        except Exception as exc:
            return ToolResult(
                tool=self.name.value,
                success=False,
                error=str(exc),
            )