"""Adapter for vikhyatk/moondream2 (local, HuggingFace-loaded).

IMPORTANT — trust_remote_code
==============================
Moondream2 ships custom model code in its HuggingFace repository.
Loading it requires ``trust_remote_code=True``.  This is explicit in
every call below.  Review the model card before enabling in a
production or shared environment.

Pinned revision
===============
We pin ``revision="2025-06-21"`` (the latest entry in
``vikhyatk/moondream2/blob/main/versions.txt`` at time of
implementation).  Pinning prevents silent breaking changes when the
upstream model is updated.  To upgrade: change the constant below
and re-verify the API (the ``answer_question`` / ``caption`` surface
is historically stable, but check after each bump).

Hardware strategy
=================
* CUDA preferred (fits ~4 GiB VRAM in fp16 on RTX 3050 6 GB).
* CPU fallback if CUDA is unavailable — slower but functional.
* OOM at inference time: caught, model reloaded on CPU, retried once.
* Missing weights: raises ``MoondreamLoadError`` with a setup command
  rather than downloading silently.
"""

from __future__ import annotations

import filecmp
import importlib
import logging
import os
import shutil
import warnings
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

# ── pinned revision ────────────────────────────────────────────────────────────
MOONDREAM_HF_REPO = "vikhyatk/moondream2"
MOONDREAM_REVISION = "2025-06-21"


class MoondreamLoadError(RuntimeError):
    """Raised when the Moondream2 runtime cannot be loaded."""


class MoondreamAdapter:
    """Thin wrapper around the vikhyatk/moondream2 HuggingFace model.

    Load once via ``load()``, then call ``answer()`` or ``caption()``
    repeatedly without reloading.

    Parameters
    ----------
    model_path:
        **Optional** path to an already-downloaded local directory.
        When supplied, weights are loaded from disk (no internet
        required).  When ``None``, the adapter raises
        ``MoondreamLoadError`` so the caller can surface a setup
        message — automatic downloads are intentionally disabled.
    device:
        PyTorch device string (``"cuda"``, ``"cpu"``, ``"cuda:0"``
        etc.).  ``"auto"`` lets the adapter pick CUDA when available,
        otherwise CPU.
    """

    def __init__(
        self,
        model_path: Path | None = None,
        device: str = "auto",
    ) -> None:
        self.model_path = model_path
        self._requested_device = device
        self._device: str | None = None
        self.model = None
        self.tokenizer = None

    # ── public interface ───────────────────────────────────────────────────────

    @property
    def loaded(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        """Load the Moondream2 model and tokenizer.

        Idempotent — does nothing if already loaded.

        Raises
        ------
        MoondreamLoadError
            If weights are unavailable or required libraries are missing.
        """
        if self.loaded:
            return

        device = self._resolve_device()

        # Validate weight source before any heavy import.
        local_dir = self._validated_local_dir()

        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            raise MoondreamLoadError(
                "Moondream2 requires the 'transformers' library.  "
                "Install it with:  pip install transformers>=4.36.0 accelerate einops"
            ) from exc

        load_kwargs: dict = {
            "trust_remote_code": True,  # Required: Moondream2 uses custom HF model code.
            "revision": MOONDREAM_REVISION,
        }
        if local_dir is not None:
            load_kwargs["local_files_only"] = True
            src = str(local_dir.resolve())
            _sync_local_dynamic_modules(local_dir)
        else:
            src = MOONDREAM_HF_REPO

        if device.startswith("cuda"):
            load_kwargs["torch_dtype"] = "auto"
        # CPU path: omit torch_dtype to let transformers default to float32.

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self.tokenizer = AutoTokenizer.from_pretrained(src, **load_kwargs)
                self.model = AutoModelForCausalLM.from_pretrained(src, **load_kwargs)
            self.model.eval()
            if device.startswith("cuda"):
                try:
                    self.model = self.model.to(device)
                except RuntimeError as oom:
                    if "out of memory" in str(oom).lower():
                        logger.warning(
                            "CUDA OOM while moving Moondream2 to %s — falling back to CPU.",
                            device,
                        )
                        device = "cpu"
                        self.model = self.model.to("cpu")
                    else:
                        raise
            self._device = device
            logger.info("Moondream2 loaded on %s (revision=%s).", device, MOONDREAM_REVISION)
        except MoondreamLoadError:
            raise
        except Exception as exc:
            self.model = None
            self.tokenizer = None
            raise MoondreamLoadError(f"Moondream2 loading failed: {exc}") from exc

    def answer(self, image: Image.Image, question: str) -> str:
        """Run VQA: return a text answer for the given image and question.

        Parameters
        ----------
        image:
            Prepared PIL.Image (RGB, ≤2048 px on longest side — the
            caller is expected to have applied ``prepare_image()``
            before calling this method).
        question:
            Natural-language question string.

        Returns
        -------
        str
            The model's answer text.

        Raises
        ------
        MoondreamLoadError
            If the model has not been loaded or an OOM occurs and the
            CPU retry also fails.
        """
        if not self.loaded:
            raise MoondreamLoadError("Moondream2 has not been loaded. Call load() first.")

        return self._run_answer(image, question)

    def caption(self, image: Image.Image, length: str = "normal") -> str:
        """Run captioning: return a text description of the image.

        Parameters
        ----------
        image:
            Prepared PIL.Image (RGB, ≤2048 px on longest side).
        length:
            Caption verbosity.  One of ``"short"``, ``"normal"``,
            ``"long"``.  Defaults to ``"normal"``.

        Returns
        -------
        str
            The model's caption text.

        Raises
        ------
        MoondreamLoadError
            If the model has not been loaded.
        """
        if not self.loaded:
            raise MoondreamLoadError("Moondream2 has not been loaded. Call load() first.")

        return self._run_caption(image, length)

    # ── private helpers ────────────────────────────────────────────────────────

    def _resolve_device(self) -> str:
        """Return the concrete device string to use."""
        if self._requested_device == "auto":
            try:
                import torch
                return "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                return "cpu"
        return self._requested_device

    def _validated_local_dir(self) -> Path | None:
        """Return a validated local model directory, or None if not set.

        If ``model_path`` is set but does not exist on disk, raises
        ``MoondreamLoadError`` with a setup command instead of
        attempting a download.
        """
        if self.model_path is None:
            # No local path supplied → would require a download.
            # We raise here to enforce the no-auto-download rule.
            raise MoondreamLoadError(
                "Moondream2 weights are not available locally.  "
                "Download them once with:\n\n"
                "    python -c \""
                "from huggingface_hub import snapshot_download; "
                f"snapshot_download('vikhyatk/moondream2', revision='{MOONDREAM_REVISION}', "
                "local_dir='weights/moondream2')\"\n\n"
                "Then pass --model-path weights/moondream2 to the CLI, "
                "or set MoondreamConfig(model_path=...) in code."
            )
        p = Path(self.model_path)
        if not p.is_dir():
            raise MoondreamLoadError(
                f"Configured Moondream2 model_path does not exist: {p}\n"
                "Run the download command to populate it."
            )
        return p

    def _run_answer(self, image: Image.Image, question: str) -> str:
        """Inner VQA call with CUDA-OOM fallback to CPU."""
        try:
            enc_image = self.model.encode_image(image)
            return self.model.answer_question(enc_image, question, self.tokenizer)
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                logger.warning("CUDA OOM during Moondream2 VQA — retrying on CPU.")
                return self._fallback_cpu_answer(image, question)
            raise MoondreamLoadError(f"Moondream2 VQA inference failed: {exc}") from exc
        except Exception as exc:
            raise MoondreamLoadError(f"Moondream2 VQA inference failed: {exc}") from exc

    def _run_caption(self, image: Image.Image, length: str) -> str:
        """Inner caption call with CUDA-OOM fallback to CPU."""
        try:
            return self.model.caption(image, length=length)["caption"]
        except RuntimeError as exc:
            if "out of memory" in str(exc).lower():
                logger.warning("CUDA OOM during Moondream2 captioning — retrying on CPU.")
                return self._fallback_cpu_caption(image, length)
            raise MoondreamLoadError(f"Moondream2 captioning inference failed: {exc}") from exc
        except Exception as exc:
            raise MoondreamLoadError(f"Moondream2 captioning inference failed: {exc}") from exc

    def _fallback_cpu_answer(self, image: Image.Image, question: str) -> str:
        """Move model to CPU and retry VQA.  Updates internal device state."""
        try:
            self.model = self.model.to("cpu")
            self._device = "cpu"
            enc_image = self.model.encode_image(image)
            return self.model.answer_question(enc_image, question, self.tokenizer)
        except Exception as exc:
            raise MoondreamLoadError(
                f"Moondream2 VQA failed even on CPU fallback: {exc}"
            ) from exc

    def _fallback_cpu_caption(self, image: Image.Image, length: str) -> str:
        """Move model to CPU and retry captioning.  Updates internal device state."""
        try:
            self.model = self.model.to("cpu")
            self._device = "cpu"
            return self.model.caption(image, length=length)["caption"]
        except Exception as exc:
            raise MoondreamLoadError(
                f"Moondream2 captioning failed even on CPU fallback: {exc}"
            ) from exc


def _sync_local_dynamic_modules(local_dir: Path) -> None:
    """Synchronize Python files from the local model directory into the

    HuggingFace transformers dynamic modules cache.

    When `AutoModelForCausalLM.from_pretrained` loads custom code with
    `trust_remote_code=True` from a local directory, Transformers only copies
    the primary module file and its immediate relative imports into
    `HF_MODULES_CACHE/transformers_modules/<submodule>`. Secondary relative
    imports (such as `layers.py` and `lora.py` imported by `moondream.py`)
    are not recursively copied by Transformers for local paths, causing
    `FileNotFoundError` when `get_class_in_module` calculates relative imports.

    Pre-syncing all `.py` files from the local directory into the dynamic module
    cache ensures all required modules are present before model instantiation.
    """
    try:
        from transformers.dynamic_module_utils import create_dynamic_module
        from transformers.utils import HF_MODULES_CACHE, TRANSFORMERS_DYNAMIC_MODULE_NAME

        submodule = local_dir.resolve().name
        full_submodule = os.path.join(TRANSFORMERS_DYNAMIC_MODULE_NAME, submodule)
        create_dynamic_module(full_submodule)

        target_dir = Path(HF_MODULES_CACHE) / full_submodule
        target_dir.mkdir(parents=True, exist_ok=True)

        for py_file in local_dir.glob("*.py"):
            target_file = target_dir / py_file.name
            if not target_file.exists() or not filecmp.cmp(str(py_file), str(target_file)):
                shutil.copy(str(py_file), str(target_file))

        importlib.invalidate_caches()
    except Exception as exc:
        logger.warning("Could not pre-sync local Moondream2 modules to HF cache: %s", exc)

