from ..domain.models import RoutingDecision, ToolParameters
from ..schemas.response import ToolResult
from ..tools.registry import ToolRegistry


class ExecutionResult:
    def __init__(self, results: list[ToolResult]):
        self.results = results

    @property
    def successful(self) -> list[ToolResult]:
        return [result for result in self.results if result.success]

    @property
    def failed(self) -> list[ToolResult]:
        return [result for result in self.results if not result.success]

    @property
    def all_successful(self) -> bool:
        return bool(self.results) and not self.failed

    @property
    def all_failed(self) -> bool:
        return bool(self.results) and not self.successful


class Executor:
    def __init__(self, registry: ToolRegistry):
        self.registry = registry

    def execute(
        self,
        decision: RoutingDecision,
        params: ToolParameters,
    ) -> ExecutionResult:

        results: list[ToolResult] = []

        for task in decision.tasks:
            try:
                tool = self.registry.get(task)
                result = tool.run(params)
                results.append(result)

            except Exception as exc:
                results.append(
                    ToolResult(
                        tool=task.value,
                        success=False,
                        error=str(exc),
                    )
                )

        return ExecutionResult(results)