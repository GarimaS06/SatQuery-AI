"""Public, standalone remote-sensing scene captioning boundary for Person C."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .geochat_adapter import GeoChatAdapter, GeoChatLoadError
from .image_processing import ImageInput, ImageValidationError, prepare_image
from .types import CaptionResult, GeoChatConfig

DEFAULT_CAPTION_PROMPT = "[caption] Describe the given remote sensing image in detail."


class PersonCCaptioningService:
    """Owns one reusable GeoChat adapter for remote-sensing scene captioning."""

    def __init__(self, config: GeoChatConfig | None = None) -> None:
        self.config = config or GeoChatConfig()
        self._adapter = GeoChatAdapter(self.config) if self.config.mode == "real" else None

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

        effective_prompt = prompt.strip() if isinstance(prompt, str) and prompt.strip() else DEFAULT_CAPTION_PROMPT

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

        if self.config.mode == "mock":
            return CaptionResult(
                caption="MOCK TEST OUTPUT: remote-sensing scene captioning model execution is not enabled.",
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
            caption_text = self._adapter.caption(prepared.image, effective_prompt)
            return CaptionResult(
                caption=caption_text,
                model_name=self.config.model_name,
                status="ready",
                warnings=prepared.warnings,
                metadata=result_metadata,
            )
        except GeoChatLoadError as exc:
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
            model_name=self.config.model_name,
            status="error",
            warnings=warnings or [],
            error=error,
            metadata=dict(metadata or {}),
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Person C remote-sensing scene captioning boundary")
    parser.add_argument("--image", required=True, help="Path to a PNG image")
    parser.add_argument("--prompt", default=DEFAULT_CAPTION_PROMPT, help="Natural-language captioning prompt")
    parser.add_argument("--mock", action="store_true", help="Use CPU-safe mock inference (recommended for now)")
    parser.add_argument("--model-path", type=Path, help="Existing local GeoChat checkpoint directory")
    parser.add_argument("--model-base", type=Path, help="Base model path when loading LoRA adapter")
    parser.add_argument("--geochat-repo-path", type=Path, help="Existing checkout of official GeoChat code")
    parser.add_argument("--load-4bit", action="store_true", help="Request official GeoChat 4-bit loading in real mode")
    parser.add_argument("--load-8bit", action="store_true", help="Request official GeoChat 8-bit loading in real mode")
    parser.add_argument("--device", default="cuda", help="CUDA device for real mode (default: cuda)")
    args = parser.parse_args()

    if not args.mock and args.model_path is None:
        parser.error("Real mode requires --model-path. Use --mock to avoid loading weights.")

    config = GeoChatConfig(
        mode="mock" if args.mock else "real",
        model_path=args.model_path,
        model_base=args.model_base,
        geochat_repo_path=args.geochat_repo_path,
        load_4bit=args.load_4bit,
        load_8bit=args.load_8bit,
        device=args.device,
    )
    result = PersonCCaptioningService(config).caption(args.image, prompt=args.prompt)
    print(json.dumps(result.to_dict(), indent=2))
    return 0 if result.status != "error" else 1


if __name__ == "__main__":
    raise SystemExit(main())
