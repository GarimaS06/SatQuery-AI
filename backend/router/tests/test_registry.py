from backend.router.domain.enums import TaskType
from backend.router.tools.registry import ToolRegistry


class FakeTool:
    def __init__(self, name):
        self.name = name

    def run(self, params):
        return None


def test_registry_get():
    ndvi_tool = FakeTool(TaskType.NDVI)

    registry = ToolRegistry({
        TaskType.NDVI: ndvi_tool,
    })

    assert registry.get(TaskType.NDVI) is ndvi_tool


def test_registry_has():
    registry = ToolRegistry({
        TaskType.NDVI: FakeTool(TaskType.NDVI),
    })

    assert registry.has(TaskType.NDVI)
    assert not registry.has(TaskType.NDWI)


def test_registry_available_tasks():
    registry = ToolRegistry({
        TaskType.NDVI: FakeTool(TaskType.NDVI),
        TaskType.NDWI: FakeTool(TaskType.NDWI),
    })

    tasks = registry.available_tasks()

    assert tasks == [
        TaskType.NDVI,
        TaskType.NDWI,
    ]


def test_registry_missing_tool():
    registry = ToolRegistry({})

    try:
        registry.get(TaskType.NDVI)
        assert False, "Expected KeyError"
    except KeyError as exc:
        assert "ndvi" in str(exc)