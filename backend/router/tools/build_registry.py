from ..domain.enums import TaskType

from .registry import ToolRegistry
from .ndvi_tool import NDVITool
from .ndwi_tool import NDWITool
from .ndbi_tool import NDBITool
from .vqa_tool import VQATool
from .change_detection_tool import ChangeDetectionTool
from .captioning_tool import CaptioningTool


def build_registry() -> ToolRegistry:
    tools = {
    TaskType.NDVI: NDVITool(),
    TaskType.NDWI: NDWITool(),
    TaskType.NDBI: NDBITool(),
    TaskType.CHANGE_DETECTION: ChangeDetectionTool(),
    TaskType.VQA: VQATool(),
    TaskType.CAPTIONING: CaptioningTool(),
}

    return ToolRegistry(tools)