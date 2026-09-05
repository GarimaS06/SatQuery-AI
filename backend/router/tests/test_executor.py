from backend.router.domain.enums import TaskType, Intent, Modality
from backend.router.domain.models import RoutingDecision, ToolParameters
from backend.router.schemas.response import ToolResult
from backend.router.orchestration.executor import Executor


class FakeNDVITool:
    name = TaskType.NDVI

    def run(self, params):
        return ToolResult(
            tool="ndvi",
            success=True,
            output={"ndvi_mean": 0.72},
            evidence={"mean_ndvi": 0.72},
        )


class FakeFailingTool:
    name = TaskType.NDBI

    def run(self, params):
        return ToolResult(
            tool="ndbi",
            success=False,
            error="NDBI processing failed",
        )


class FakeRegistry:
    def __init__(self):
        self.tools = {
            TaskType.NDVI: FakeNDVITool(),
            TaskType.NDBI: FakeFailingTool(),
        }

    def get(self, task):
        return self.tools[task]


def test_executor_success():
    registry = FakeRegistry()
    executor = Executor(registry)

    decision = RoutingDecision(
        intent=Intent.ANALYZE,
        tasks=[TaskType.NDVI],
        modality=Modality.SINGLE_IMAGE,
    )

    params = ToolParameters(
        image_path="test.png"
    )

    result = executor.execute(decision, params)

    assert len(result.results) == 1
    assert result.successful[0].tool == "ndvi"
    assert result.all_successful


def test_executor_partial_failure():
    registry = FakeRegistry()
    executor = Executor(registry)

    decision = RoutingDecision(
        intent=Intent.ANALYZE,
        tasks=[TaskType.NDVI, TaskType.NDBI],
        modality=Modality.SINGLE_IMAGE,
    )

    params = ToolParameters(
        image_path="test.png"
    )

    result = executor.execute(decision, params)

    assert len(result.results) == 2
    assert len(result.successful) == 1
    assert len(result.failed) == 1