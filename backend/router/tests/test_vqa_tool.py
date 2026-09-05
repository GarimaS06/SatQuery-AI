from backend.router.domain.models import ToolParameters
from backend.router.tools.vqa_tool import VQATool


def test_vqa_tool_mock():
    tool = VQATool()

    result = tool.run(
        ToolParameters(
            image_path="backend/router/tests/fixtures/vqa_test.png",
            question="What do you see in this image?",
            extra={},
        )
    )

    assert result.tool == "vqa"
    assert result.success is True
    assert result.output["answer"]
    assert result.output["model_name"] == "MBZUAI/geochat-7B"
    assert result.output["status"] == "mock"
    assert result.error is None
    assert result.warnings