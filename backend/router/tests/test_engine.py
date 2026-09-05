import pytest

from backend.router.domain.enums import TaskType
from backend.router.rules.engine import route, validate_decision

def test_direct_ndvi():
    decision = route("Calculate NDVI for this image", False)

    assert decision.tasks == [TaskType.NDVI]

def test_direct_ndvi_and_ndwi():
    decision = route("Show NDVI and NDWI", False)

    assert decision.tasks == [
        TaskType.NDVI,
        TaskType.NDWI,
    ]
    assert decision.confidence == 0.95
    assert decision.ambiguous is False

def test_vegetation_change():
    decision = route(
        "Compare vegetation change between these two images",
        True,
    )

    assert decision.tasks == [
        TaskType.NDVI,
        TaskType.CHANGE_DETECTION,
    ]
    assert decision.confidence == 0.90
    assert decision.ambiguous is False

def test_vqa_fallback():
    decision = route(
        "What is visible in this image?",
        False,
    )

    assert decision.tasks == [TaskType.VQA]
    assert decision.confidence == 0.30
    assert decision.ambiguous is False    

def test_ambiguous_synonyms():
    decision = route(
        "Show vegetation and buildings",
        False,
    )

    assert decision.tasks == [
        TaskType.NDVI,
        TaskType.NDBI,
    ]
    assert decision.confidence == 0.50
    assert decision.ambiguous is True

def test_change_detection_requires_image2():
    decision = route(
        "Detect changes between these two images",
        False,
    )

    assert decision.tasks == [TaskType.CHANGE_DETECTION]

    with pytest.raises(ValueError, match="second image"):
        validate_decision(decision, False)

def test_direct_keyword_wins_over_unrelated_synonym():
    decision = route(
        "Calculate NDVI for the water",
        False,
    )

    assert decision.tasks == [TaskType.NDVI]
    assert decision.confidence == 0.95
    assert decision.ambiguous is False

def test_compare_vegetation_requires_image2():
    decision = route(
        "Compare vegetation",
        False,
    )

    assert decision.tasks == [
        TaskType.NDVI,
        TaskType.CHANGE_DETECTION,
    ]

    with pytest.raises(ValueError, match="second image"):
        validate_decision(decision, False)

def test_change_with_multiple_analysis_signals():
    decision = route(
        "Compare vegetation and buildings",
        True,
    )

    assert decision.tasks == [
        TaskType.NDVI,
        TaskType.CHANGE_DETECTION,
    ]
    assert decision.confidence == 0.50
    assert decision.ambiguous is True