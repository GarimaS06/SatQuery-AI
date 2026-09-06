from ..domain.enums import TaskType
from ..domain.models import ToolParameters
from ..schemas.response import ToolResult

from ml.person_c.service import PersonCVQAService


class VQATool:
    name = TaskType.VQA

    def __init__(self):
        self.service = PersonCVQAService()

    def run(self, params: ToolParameters) -> ToolResult:
        try:
            result = self.service.answer(
                image=params.image_path,
                question=params.question,
                metadata=params.extra,
            )

            data = result.to_dict()

            return ToolResult(
                tool=self.name.value,
                success=data.get("status") in {"ready", "mock"},
                output={
                    "answer": data.get("answer"),
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