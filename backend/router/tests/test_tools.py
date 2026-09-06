from unittest.mock import patch

from backend.router.domain.enums import TaskType
from backend.router.domain.models import ToolParameters
from backend.router.schemas.response import ToolResult
from backend.router.tools.ndvi_tool import NDVITool


class FakeAnalysisResult:
    success = True
    analysis_type = "ndvi"
    result = {"mean": 0.56}
    evidence = {"vegetation_percentage": 97.4}
    output_files = {"map": "outputs/ndvi_map.png"}
    metadata = {"pixel_size_m": 30}
    warnings = []
    error = None


@patch("person_b.spectral_indices.compute_ndvi")
@patch("backend.router.tools.ndvi_tool.get_loaded_image")
def test_ndvi_tool_success(mock_loader, mock_compute):
    mock_loader.return_value = "fake-loaded-image"
    mock_compute.return_value = FakeAnalysisResult()

    tool = NDVITool()

    result = tool.run(
        ToolParameters(
            image_path="fake/image.tif"
        )
    )

    assert isinstance(result, ToolResult)
    assert result.tool == TaskType.NDVI.value
    assert result.success is True
    assert result.output["analysis_type"] == "ndvi"
    assert result.output["result"]["mean"] == 0.56
    assert result.evidence["vegetation_percentage"] == 97.4
    assert result.output_files == {
        "map": "outputs/ndvi_map.png"
    }

    mock_loader.assert_called_once_with("fake/image.tif")
    mock_compute.assert_called_once_with("fake-loaded-image")