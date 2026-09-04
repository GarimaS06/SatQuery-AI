"""Public, standalone inference boundary for Person C."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .geochat_adapter import GeoChatAdapter, GeoChatLoadError
from .image_processing import ImageInput, ImageValidationError, prepare_image
from .types import GeoChatConfig, VQAResult


class PersonCVQAService:
    """Owns one reusable GeoChat adapter rather than loading per request."""

    def __init__(self, config: GeoChatConfig | None = None) -> None:
        self.config = config or GeoChatConfig()
        self._adapter = GeoChatAdapter(self.config) if self.config.mode == "real" else None

    def answer(
        self,
        image: ImageInput,
        question: str,
        metadata: dict[str, Any] | None = None,
    ) -> VQAResult:
        question_error = _validate_question(question)
        if question_error:
            return self._error_result(question_error, metadata)

        try:
            prepared = prepare_image(image)
        except ImageValidationError as exc:
            return self._error_result(str(exc), metadata)

        result_metadata = dict(metadata or {})
        result_metadata["person_c_image"] = {
            "source_width": prepared.source_width,
            "source_height": prepared.source_height,
            "width": prepared.width,
            "height": prepared.height,
            "converted_to_rgb": prepared.converted_to_rgb,
            "was_resized": prepared.was_resized,
        }

        if self.config.mode == "mock":
            return VQAResult(
                answer="MOCK TEST OUTPUT: remote-sensing VQA model execution is not enabled.",
                model_name=self.config.model_name,
                status="mock",
                warnings=prepared.warnings + [
                    "Mock mode: no GeoChat weights were loaded and this is not a model prediction."
                ],
                metadata=result_metadata,
            )

        try:
            assert self._adapter is not None
            self._adapter.load()
            answer = self._adapter.answer(prepared.image, question.strip())
            return VQAResult(
                answer=answer,
                model_name=self.config.model_name,
                status="ready",
                warnings=prepared.warnings,
                metadata=result_metadata,
            )
        except GeoChatLoadError as exc:
            return self._error_result(str(exc), result_metadata, prepared.warnings)

    def _error_result(
        self,
        error: str,
        metadata: dict[str, Any] | None,
        warnings: list[str] | None = None,
    ) -> VQAResult:
        return VQAResult(
            answer=None,
            model_name=self.config.model_name,
            status="error",
            warnings=warnings or [],
            error=error,
            metadata=dict(metadata or {}),
        )


def _validate_question(question: object) -> str | None:
    if not isinstance(question, str):
        return "Question must be a text string."
    if not question.strip():
        return "Question cannot be empty."
    if len(question.strip()) > 1000:
        return "Question must be no more than 1000 characters."
    return None
