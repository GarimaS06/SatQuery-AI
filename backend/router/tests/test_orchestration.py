from backend.router.orchestration.evidence_builder import build_evidence
from backend.router.orchestration.confidence import calculate_confidence
from backend.router.schemas.response import ToolResult


def test_evidence_builder():
    results = [
        ToolResult(
            tool="ndvi",
            success=True,
            evidence={"mean_ndvi": 0.72},
        ),
        ToolResult(
            tool="ndbi",
            success=False,
            error="Failed",
        ),
    ]

    evidence = build_evidence(results)

    assert len(evidence) == 1
    assert evidence[0].tool == "ndvi"
    assert evidence[0].data["mean_ndvi"] == 0.72


def test_confidence_all_success():
    results = [
        ToolResult(tool="ndvi", success=True),
    ]

    confidence = calculate_confidence(0.95, results)

    assert confidence == 0.95


def test_confidence_partial():
    results = [
        ToolResult(tool="ndvi", success=True),
        ToolResult(tool="ndbi", success=False),
    ]

    confidence = calculate_confidence(0.95, results)

    assert confidence == 0.47


def test_confidence_all_failed():
    results = [
        ToolResult(tool="ndvi", success=False),
        ToolResult(tool="ndbi", success=False),
    ]

    confidence = calculate_confidence(0.95, results)

    assert confidence == 0.1