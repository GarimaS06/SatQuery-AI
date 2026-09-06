"""Person C's isolated remote-sensing VQA and captioning boundary."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .service import PersonCVQAService
from .vqa_types import CaptionResult, GeoChatConfig, MoondreamConfig, VQAResult

if TYPE_CHECKING:
    from .captioning import PersonCCaptioningService
    from .moondream_adapter import MoondreamAdapter


def __getattr__(name: str):
    if name == "PersonCCaptioningService":
        from .captioning import PersonCCaptioningService

        return PersonCCaptioningService
    if name == "MoondreamAdapter":
        from .moondream_adapter import MoondreamAdapter

        return MoondreamAdapter
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "CaptionResult",
    "GeoChatConfig",
    "MoondreamConfig",
    "MoondreamAdapter",
    "PersonCCaptioningService",
    "PersonCVQAService",
    "VQAResult",
]
