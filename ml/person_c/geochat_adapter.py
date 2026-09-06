"""Deferred adapter for the official GeoChat repository.

Nothing in this module is imported or executed in mock mode. Real mode only
accepts an existing local checkpoint directory, preventing accidental weight
downloads from a model hub.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

from .vqa_types import GeoChatConfig


class GeoChatLoadError(RuntimeError):
    """Raised when the explicitly configured local GeoChat runtime cannot load."""


class GeoChatAdapter:
    """Thin wrapper around GeoChat's official loader and single-image VQA flow."""

    def __init__(self, config: GeoChatConfig) -> None:
        self.config = config
        self.tokenizer = None
        self.model = None
        self.image_processor = None
        self.context_len = None

    @property
    def loaded(self) -> bool:
        return self.model is not None

    def required_cuda_vram_gib(self) -> int:
        """Return a conservative minimum for stable, single-image inference.

        These are deployment safety thresholds, not claims made by the
        GeoChat authors. They include headroom for the 504px vision tower,
        image tokens, KV cache, and CUDA allocator overhead in addition to
        language-model weights.
        """

        if self.config.load_4bit and self.config.load_8bit:
            raise GeoChatLoadError("Choose either GeoChat 4-bit or 8-bit loading, not both.")
        if self.config.load_4bit:
            return 12
        if self.config.load_8bit:
            return 12
        return 20

    def load(self) -> None:
        if self.loaded:
            return
        if self.config.model_path is None or not self.config.model_path.is_dir():
            raise GeoChatLoadError(
                "Real GeoChat mode requires model_path to be an existing local checkpoint directory; "
                "automatic downloads are intentionally disabled."
            )
        if self.config.geochat_repo_path is not None:
            repo_path = self.config.geochat_repo_path
            if not repo_path.is_dir():
                raise GeoChatLoadError(f"Configured geochat_repo_path does not exist: {repo_path}")
            if str(repo_path) not in sys.path:
                sys.path.insert(0, str(repo_path))

        self._validate_hardware()

        try:
            from geochat.mm_utils import get_model_name_from_path
            from geochat.model.builder import load_pretrained_model
        except ImportError as exc:
            raise GeoChatLoadError(
                "Official GeoChat code is unavailable. Install/clone the official GeoChat repository "
                "outside this module and set geochat_repo_path, or install its package before real mode."
            ) from exc

        try:
            model_path = str(self.config.model_path)
            model_name = get_model_name_from_path(model_path)
            self.tokenizer, self.model, self.image_processor, self.context_len = load_pretrained_model(
                model_path,
                str(self.config.model_base) if self.config.model_base else None,
                model_name,
                load_8bit=self.config.load_8bit,
                load_4bit=self.config.load_4bit,
                device_map=self.config.device_map,
                device=self.config.device,
            )
            self.model.eval()
        except Exception as exc:  # External model stack: preserve a stable boundary.
            raise GeoChatLoadError(f"Official GeoChat loading failed: {exc}") from exc

    def _validate_hardware(self) -> None:
        """Fail before loading when the configured device is demonstrably unsafe.

        GeoChat's official loader moves the complete vision tower to the
        requested device and offers no supported CPU-offload configuration for
        the multimodal path. This guard deliberately does not attempt to
        reinterpret system RAM as GPU VRAM.
        """

        if not self.config.enforce_hardware_guard:
            return
        if not self.config.device.startswith("cuda"):
            raise GeoChatLoadError(
                "CPU/offloaded GeoChat inference is not enabled by this safe setup. The official loader "
                "still places its vision tower on the requested device, and 16 GB system RAM is insufficient "
                "headroom for a reliable 7B multimodal runtime. Use a CUDA GPU meeting the documented threshold."
            )
        try:
            import torch
        except ImportError as exc:
            raise GeoChatLoadError("Real GeoChat mode requires the CUDA-enabled PyTorch runtime.") from exc
        if not torch.cuda.is_available():
            raise GeoChatLoadError("Real GeoChat mode requires an available CUDA GPU.")

        try:
            device_index = torch.device(self.config.device).index
            total_gib = torch.cuda.get_device_properties(device_index or 0).total_memory / (1024**3)
        except Exception as exc:
            raise GeoChatLoadError(f"Could not inspect configured CUDA device '{self.config.device}': {exc}") from exc

        required_gib = self.required_cuda_vram_gib()
        if total_gib < required_gib:
            quantization = "4-bit" if self.config.load_4bit else "8-bit" if self.config.load_8bit else "FP16"
            raise GeoChatLoadError(
                f"GeoChat {quantization} inference requires at least {required_gib} GiB dedicated CUDA VRAM "
                f"for this safe setup; detected {total_gib:.1f} GiB. System RAM is not a substitute for VRAM."
            )

    def answer(self, image: Image.Image, question: str) -> str:
        """Run the official GeoChat-style one-image generation path.

        This follows the project's batch VQA example: image token + LLaVA
        conversation template, official image processor, greedy generation.
        """

        if not self.loaded:
            raise GeoChatLoadError("GeoChat has not been loaded.")
        try:
            import torch
            from geochat.constants import DEFAULT_IMAGE_TOKEN, DEFAULT_IM_END_TOKEN, DEFAULT_IM_START_TOKEN, IMAGE_TOKEN_INDEX
            from geochat.conversation import conv_templates
            from geochat.mm_utils import process_images, tokenizer_image_token
        except ImportError as exc:
            raise GeoChatLoadError("Official GeoChat inference dependencies are unavailable.") from exc

        if self.config.conversation_mode not in conv_templates:
            raise GeoChatLoadError(f"Unknown GeoChat conversation mode: {self.config.conversation_mode}")

        prompt_question = question
        if getattr(self.model.config, "mm_use_im_start_end", False):
            prompt_question = f"{DEFAULT_IM_START_TOKEN}{DEFAULT_IMAGE_TOKEN}{DEFAULT_IM_END_TOKEN}\n{question}"
        else:
            prompt_question = f"{DEFAULT_IMAGE_TOKEN}\n{question}"

        conversation = conv_templates[self.config.conversation_mode].copy()
        conversation.append_message(conversation.roles[0], prompt_question)
        conversation.append_message(conversation.roles[1], None)
        prompt = conversation.get_prompt()

        model_device = getattr(self.model, "device", self.config.device)
        input_ids = tokenizer_image_token(prompt, self.tokenizer, IMAGE_TOKEN_INDEX, return_tensors="pt").unsqueeze(0)
        input_ids = input_ids.to(model_device)
        image_tensor = process_images([image], self.image_processor, self.model.config)
        dtype = torch.float16 if str(model_device).startswith("cuda") else torch.float32
        image_tensor = image_tensor.to(device=model_device, dtype=dtype)

        with torch.inference_mode():
            output_ids = self.model.generate(
                input_ids,
                images=image_tensor,
                do_sample=False,
                temperature=0.0,
                max_new_tokens=self.config.max_new_tokens,
                use_cache=True,
            )
        answer = self.tokenizer.decode(output_ids[0, input_ids.shape[1] :], skip_special_tokens=True).strip()
        return answer

    def caption(self, image: Image.Image, prompt: str = "[caption] Describe the given remote sensing image in detail.") -> str:
        """Run official GeoChat scene captioning generation using the caption instruction format."""
        return self.answer(image, prompt)
