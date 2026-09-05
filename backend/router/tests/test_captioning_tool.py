from backend.router.domain.models import ToolParameters
from backend.router.tools.captioning_tool import CaptioningTool


def test_captioning_tool_mock():
    tool = CaptioningTool()

    result = tool.run(
        ToolParameters(
            image_path="backend/router/tests/fixtures/vqa_test.png",
            extra={},
        )
    )

    assert result.tool == "captioning"
    assert result.success is True
    assert result.output["caption"]
    assert result.output["model_name"] == "MBZUAI/geochat-7B"
    assert result.output["status"] == "mock"
    assert result.error is None
    assert result.warnings