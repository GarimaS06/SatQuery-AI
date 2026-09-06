"""Internal contracts for Person C.

These types deliberately do not mirror Person B's AnalysisResult, whose
schema has not yet been supplied to this repository.

Note: This file was originally named ``types.py``.  It was renamed to
``vqa_types.py`` to avoid shadowing Python's built-in ``types`` standard
library module, which caused ``ImportError: cannot import name
'MappingProxyType' from 'types'`` in environments that transitively
import stdlib ``types``.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Literal


@dataclass(frozen=True)
class GeoChatConfig:
    """Configuration for a local, explicitly installed GeoChat runtime.

    ``model_path`` must point to an already-downloaded local model directory.
    The module never resolves a Hugging Face identifier or downloads weights.
    """

    mode: Literal["mock", "real"] = "mock"
    model_name: str = "MBZUAI/geochat-7B"
    model_path: Path | None = None
    model_base: Path | None = None
    geochat_repo_path: Path | None = None
    device: str = "cuda"
    device_map: str = "auto"
    load_4bit: bool = False
    load_8bit: bool = False
    enforce_hardware_guard: bool = True
    max_new_tokens: int = 128
    conversation_mode: str = "llava_v1"


@dataclass(frozen=True)
class MoondreamConfig:
    """Configuration for a local, explicitly installed Moondream2 runtime.

    ``model_path`` must point to an already-downloaded local directory.
    The module never resolves a Hugging Face identifier or downloads
    weights automatically.

    Note: ``trust_remote_code=True`` is required by the Moondream2 model
    and is enabled inside ``MoondreamAdapter``.  Review the model card
    at https://huggingface.co/vikhyatk/moondream2 before deploying.
    """

    model_path: Path | None = None
    device: str = "auto"
    caption_length: str = "normal"


@dataclass
class ImagePreparation:
    image: Any
    source_width: int
    source_height: int
    width: int
    height: int
    converted_to_rgb: bool
    was_resized: bool
    warnings: list[str] = field(default_factory=list)


@dataclass
class VQAResult:
    """Small Person C-only result structure for later schema adaptation."""

    answer: str | None
    model_name: str
    status: Literal["mock", "ready", "error"]
    warnings: list[str] = field(default_factory=list)
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CaptionResult:
    """Person C captioning result structure."""

    caption: str | None
    model_name: str
    status: Literal["mock", "ready", "error"]
    warnings: list[str] = field(default_factory=list)
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
