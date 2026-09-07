"""Public, standalone inference boundary for Person C.

Backend selection
-----------------
Set the environment variable ``PERSON_C_BACKEND`` to choose the inference
engine.  Valid values:

    mock       — CPU-safe stub (default when value is unrecognised).
    moondream2 — Local vikhyatk/moondream2 via HuggingFace Transformers
                 (default for prototype work, fits RTX 3050 6 GB VRAM).
    geochat    — Local MBZUAI/geochat-7B via official GeoChat repository
                 (requires ≥12 GiB VRAM; for final ML evaluation).

If the variable is not set, the default is ``moondream2``.

This convention mirrors Person A's ROUTER_ENABLED pattern in
``preprocessing/services/routerService.js``.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from .geochat_adapter import GeoChatAdapter, GeoChatLoadError
from .image_processing import ImageInput, ImageValidationError, prepare_image
from .moondream_adapter import MoondreamAdapter, MoondreamLoadError
from .vqa_types import GeoChatConfig, MoondreamConfig, VQAResult

# ── backend selection ──────────────────────────────────────────────────────────
_VALID_BACKENDS = {"mock", "moondream2", "geochat"}
_DEFAULT_BACKEND = "moondream2"


def _get_backend() -> str:
    raw = os.getenv("PERSON_C_BACKEND", _DEFAULT_BACKEND).strip().lower()
    if raw not in _VALID_BACKENDS:
        return _DEFAULT_BACKEND
    return raw


class PersonCVQAService:
    """Owns one reusable adapter rather than loading per request.

    The active backend is determined once at construction time from the
    ``PERSON_C_BACKEND`` environment variable.  Passing a ``config``
    overrides the env-var backend selection for that instance, giving
    tests fine-grained control.
    """

    def __init__(
        self,
        config: GeoChatConfig | MoondreamConfig | None = None,
        *,
        backend: str | None = None,
    ) -> None:
        # Determine effective backend string.
        if config is not None:
            if isinstance(config, GeoChatConfig):
                self._backend = "mock" if config.mode == "mock" else "geochat"
            else:  # MoondreamConfig
                self._backend = "moondream2"
        elif backend is not None:
            self._backend = backend if backend in _VALID_BACKENDS else _DEFAULT_BACKEND
        else:
            self._backend = _get_backend()

        # Keep a GeoChatConfig for mock-mode model_name / metadata.
        if isinstance(config, GeoChatConfig):
            self.config = config
        else:
            self.config = GeoChatConfig()

        self._moondream_config: MoondreamConfig | None = (
            config if isinstance(config, MoondreamConfig) else None
        )

        # Instantiate the appropriate adapter (not yet loaded).
        self._adapter: GeoChatAdapter | MoondreamAdapter | None
        if self._backend == "geochat":
            assert isinstance(config, GeoChatConfig)
            self._adapter = GeoChatAdapter(config)
        elif self._backend == "moondream2":
            if self._moondream_config is not None and self._moondream_config.model_path is not None:
                md_cfg = self._moondream_config
                model_path = md_cfg.model_path
            elif self._moondream_config is None:
                env_path = os.getenv("PERSON_C_MODEL_PATH")
                model_path = Path(env_path) if env_path else None
                md_cfg = MoondreamConfig(model_path=model_path)
            else:
                md_cfg = self._moondream_config
                model_path = md_cfg.model_path
            self._adapter = MoondreamAdapter(
                model_path=model_path,
                device=md_cfg.device,
            )
        else:
            self._adapter = None  # mock

    # ── model_name helper ──────────────────────────────────────────────────────

    @property
    def _model_name(self) -> str:
        if self._backend == "moondream2":
            from .moondream_adapter import MOONDREAM_HF_REPO, MOONDREAM_REVISION
            return f"{MOONDREAM_HF_REPO}@{MOONDREAM_REVISION}"
        return self.config.model_name

    # ── public API ─────────────────────────────────────────────────────────────

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

        if self._backend == "mock":
            return VQAResult(
                answer="MOCK TEST OUTPUT: remote-sensing VQA model execution is not enabled.",
                model_name=self.config.model_name,
                status="mock",
                warnings=prepared.warnings + [
                    "Mock mode: no model weights were loaded and this is not a model prediction."
                ],
                metadata=result_metadata,
            )

        try:
            assert self._adapter is not None
            self._adapter.load()
            answer = self._adapter.answer(prepared.image, question.strip())
            return VQAResult(
                answer=answer,
                model_name=self._model_name,
                status="ready",
                warnings=prepared.warnings,
                metadata=result_metadata,
            )
        except (GeoChatLoadError, MoondreamLoadError) as exc:
            return self._error_result(str(exc), result_metadata, prepared.warnings)

    def _error_result(
        self,
        error: str,
        metadata: dict[str, Any] | None,
        warnings: list[str] | None = None,
    ) -> VQAResult:
        return VQAResult(
            answer=None,
            model_name=self._model_name,
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
