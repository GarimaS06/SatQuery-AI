import pytest
from fastapi.testclient import TestClient
from transformers import data

from backend.router.main import app
from backend.router.api.dependencies import get_executor
from backend.router.schemas.response import ToolResult
from backend.router.orchestration.executor import ExecutionResult


class FakeExecutor:
    def execute(self, decision, params):
        results = []

        for task in decision.tasks:
            if task.value == "ndvi":
                results.append(
                    ToolResult(
                        tool="ndvi",
                        success=True,
                        output={
                            "analysis_type": "ndvi",
                            "result": {
                                "mean_ndvi": 0.72
                            },
                        },
                        evidence={
                            "mean_ndvi": 0.72
                        },
                    )
                )

            elif task.value == "ndwi":
                results.append(
                    ToolResult(
                        tool="ndwi",
                        success=True,
                        output={
                            "analysis_type": "ndwi",
                            "result": {
                                "mean_ndwi": 0.31
                            },
                        },
                        evidence={
                            "mean_ndwi": 0.31
                        },
                    )
                )

            elif task.value == "ndbi":
                results.append(
                    ToolResult(
                        tool="ndbi",
                        success=False,
                        error="NDBI processing failed",
                    )
                )

            elif task.value == "vqa":
                results.append(
                    ToolResult(
                        tool="vqa",
                        success=False,
                        error="VQA specialist not yet available",
                    )
                )

        return ExecutionResult(results)


@pytest.fixture
def client():
    app.dependency_overrides[get_executor] = (
        lambda: FakeExecutor()
    )

    yield TestClient(app)

    app.dependency_overrides.clear()


def image():
    return {
        "filename": "test.png",
        "path": "C:/test/test.png",
        "format": "png",
        "width": 512,
        "height": 512,
        "size_bytes": 10000,
    }


def second_image():
    return {
        "filename": "test2.png",
        "path": "C:/test/test2.png",
        "format": "png",
        "width": 512,
        "height": 512,
        "size_bytes": 10000,
    }


def test_health(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_analyze_ndvi(client):
    response = client.post(
        "/api/router/analyze",
        json={
            "request_id": "test-001",
            "question": "Calculate NDVI for this image",
            "image": image(),
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["intent"] == "analyze"
    assert data["tasks"] == ["ndvi"]
    assert data["modality"] == "single_image"
    assert data["tools_used"] == ["ndvi"]
    assert data["status"] == "success"
    assert data["confidence"] == 0.95
    assert "NDVI analysis completed successfully" in data["answer"]
    assert "mean ndvi: 0.72" in data["answer"]

    assert data["evidence"][0]["tool"] == "ndvi"
    assert data["evidence"][0]["data"]["mean_ndvi"] == 0.72


def test_analyze_multiple_tools(client):
    response = client.post(
        "/api/router/analyze",
        json={
            "request_id": "test-002",
            "question": "Show NDVI and NDWI",
            "image": image(),
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["tasks"] == ["ndvi", "ndwi"]
    assert data["tools_used"] == ["ndvi", "ndwi"]
    assert data["status"] == "success"
    assert data["confidence"] == 0.95
    assert len(data["results"]) == 2
    assert len(data["evidence"]) == 2


def test_partial_failure(client):
    response = client.post(
        "/api/router/analyze",
        json={
            "request_id": "test-003",
            "question": "Show NDVI and NDBI",
            "image": image(),
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["tasks"] == ["ndvi", "ndbi"]
    assert data["tools_used"] == ["ndvi"]
    assert data["status"] == "partial"
    assert data["confidence"] == 0.47

    assert len(data["results"]) == 2
    assert len(data["errors"]) == 1
    assert "NDBI processing failed" in data["errors"][0]


def test_missing_second_image(client):
    response = client.post(
        "/api/router/analyze",
        json={
            "request_id": "test-004",
            "question": "Detect changes between these two images",
            "image": image(),
        },
    )

    assert response.status_code == 400
    assert "second image" in response.json()["detail"].lower()


def test_change_detection_with_second_image(client):
    response = client.post(
        "/api/router/analyze",
        json={
            "request_id": "test-005",
            "question": "Detect changes between these two images",
            "image": image(),
            "image2": second_image(),
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["tasks"] == ["change_detection"]
    assert data["modality"] == "paired_image"


def test_vqa_fallback(client):
    response = client.post(
        "/api/router/analyze",
        json={
            "request_id": "test-006",
            "question": "What is visible in this image?",
            "image": image(),
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["tasks"] == ["vqa"]
    assert data["status"] == "failed"
    assert data["confidence"] == 0.1
    assert len(data["errors"]) == 1