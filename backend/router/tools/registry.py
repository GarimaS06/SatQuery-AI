from ..domain.enums import TaskType
from .base import SpecialistTool


class ToolRegistry:
    def __init__(self, tools: dict[TaskType, SpecialistTool]):
        self._tools = tools

    def get(self, task: TaskType) -> SpecialistTool:
        if task not in self._tools:
            raise KeyError(
                f"No tool registered for task: {task.value}"
            )

        return self._tools[task]

    def has(self, task: TaskType) -> bool:
        return task in self._tools

    def available_tasks(self) -> list[TaskType]:
        return list(self._tools.keys())