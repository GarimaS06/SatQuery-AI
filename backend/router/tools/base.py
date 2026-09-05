from typing import Protocol

from ..domain.enums import TaskType
from ..domain.models import ToolParameters
from ..schemas.response import ToolResult


class SpecialistTool(Protocol):
    name: TaskType

    def run(self, params: ToolParameters) -> ToolResult:
        ...