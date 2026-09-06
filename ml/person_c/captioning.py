"""Public, standalone remote-sensing scene captioning boundary for Person C.

Backend selection mirrors ``service.py`` — controlled by the
``PERSON_C_BACKEND`` environment variable.  See ``service.py`` for details.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from .geochat_adapter import GeoChatAdapter, GeoChatLoadError
from .image_processing import ImageInput, ImageValidationError, prepare_image
from .moondream_adapter import MoondreamAdapter, MoondreamLoadError
from .vqa_types import CaptionResult, GeoChatConfig, MoondreamConfig

DEFAULT_CAPTION_PROMPT = "[caption] Describe the given remote sensing image in detail."

# ── backend selection (mirrors service.py) ─────────────────────────────────────
_VALID_BACKENDS = {"mock", "moondream2", "geochat"}
_DEFAULT_BACKEND = "moondream2"


def _get_backend() -> str:
    raw = os.getenv("PERSON_C_BACKEND", _DEFAULT_BACKEND).strip().lower()
    if raw not in _VALID_BACKENDS:
        return _DEFAULT_BACKEND
    return raw


class PersonCCaptioningService:
    """Owns one reusable adapter for remote-sensing scene captioning."""

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
            md_cfg = self._moondream_config or MoondreamConfig()
            self._adapter = MoondreamAdapter(
                model_path=md_cfg.model_path,
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

    def caption(
        self,
        image: ImageInput,
        prompt: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CaptionResult:
        if prompt is not None and (not isinstance(prompt, str) or not prompt.strip()):
            return self._error_result("Prompt cannot be empty when supplied.", metadata)
        if prompt is not None and len(prompt.strip()) > 1000:
            return self._error_result("Prompt must be no more than 1000 characters.", metadata)

        effective_prompt = (
            prompt.strip() if isinstance(prompt, str) and prompt.strip() else DEFAULT_CAPTION_PROMPT
        )

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
        result_metadata["prompt"] = effective_prompt

        if self._backend == "mock":
            return CaptionResult(
                caption="MOCK TEST OUTPUT: remote-sensing scene captioning model execution is not enabled.",
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
            if self._backend == "moondream2":
                # Moondream2 caption() ignores text prompts; uses built-in captioning.
                caption_text = self._adapter.caption(prepared.image)
            else:
                # GeoChat caption() accepts the prompt string.
                caption_text = self._adapter.caption(prepared.image, effective_prompt)
            return CaptionResult(
                caption=caption_text,
                model_name=self._model_name,
                status="ready",
                warnings=prepared.warnings,
                metadata=result_metadata,
            )
        except (GeoChatLoadError, MoondreamLoadError) as exc:
            return self._error_result(str(exc), result_metadata, prepared.warnings)

    def generate_caption(
        self,
        image: ImageInput,
        prompt: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CaptionResult:
        """Alias for caption()."""
        return self.caption(image=image, prompt=prompt, metadata=metadata)

    def _error_result(
        self,
        error: str,
        metadata: dict[str, Any] | None,
        warnings: list[str] | None = None,
    ) -> CaptionResult:
        return CaptionResult(
            caption=None,
            model_name=self._model_name,
            status="error",
            warnings=warnings or [],
            error=error,
            metadata=dict(metadata or {}),
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Person C remote-sensing scene captioning boundary"
    )
    parser.add_argument("--image", required=True, help="Path to a PNG image")
    parser.add_argument(
        "--prompt", default=DEFAULT_CAPTION_PROMPT, help="Natural-language captioning prompt"
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Use CPU-safe mock inference (overrides PERSON_C_BACKEND)",
    )
    parser.add_argument(
        "--backend",
        choices=["mock", "moondream2", "geochat"],
        default=None,
        help="Explicit backend override (default: PERSON_C_BACKEND env var, then moondream2)",
    )
    parser.add_argument(
        "--model-path",
        type=Path,
        help="Local model checkpoint directory (GeoChat or Moondream2 weights)",
    )
    parser.add_argument(
        "--model-base",
        type=Path,
        help="Base model path when loading LoRA adapter (GeoChat only)",
    )
    parser.add_argument(
        "--geochat-repo-path",
        type=Path,
        help="Existing checkout of official GeoChat code (GeoChat only)",
    )
    parser.add_argument(
        "--load-4bit", action="store_true", help="4-bit loading (GeoChat real mode only)"
    )
    parser.add_argument(
        "--load-8bit", action="store_true", help="8-bit loading (GeoChat real mode only)"
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="Device for real mode: cuda | cpu | auto (default: auto)",
    )
    args = parser.parse_args()

    # Resolve backend.
    effective_backend = "mock" if args.mock else (args.backend or _get_backend())

    config: GeoChatConfig | MoondreamConfig
    if effective_backend == "geochat":
        if args.model_path is None:
            parser.error("GeoChat real mode requires --model-path.")
        config = GeoChatConfig(
            mode="real",
            model_path=args.model_path,
            model_base=args.model_base,
            geochat_repo_path=args.geochat_repo_path,
            load_4bit=args.load_4bit,
            load_8bit=args.load_8bit,
            device=args.device if args.device != "auto" else "cuda",
        )
    elif effective_backend == "moondream2":
        if args.model_path is None:
            parser.error(
                "Moondream2 real mode requires --model-path pointing to the downloaded weights.\n"
                "Download once with:\n"
                "  python -c \"from huggingface_hub import snapshot_download; "
                "snapshot_download('vikhyatk/moondream2', revision='2025-06-21', "
                "local_dir='weights/moondream2')\""
            )
        config = MoondreamConfig(model_path=args.model_path, device=args.device)
    else:
        config = GeoChatConfig(mode="mock")

    service = PersonCCaptioningService(config)
    # Moondream2 ignores the text prompt (uses its own captioning instruction).
    prompt_arg = args.prompt if effective_backend == "geochat" else None
    result = service.caption(args.image, prompt=prompt_arg)
    print(json.dumps(result.to_dict(), indent=2))
    return 0 if result.status != "error" else 1


if __name__ == "__main__":
    raise SystemExit(main())
