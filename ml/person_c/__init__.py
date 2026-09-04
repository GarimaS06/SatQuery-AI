"""Person C's isolated remote-sensing VQA and captioning boundary."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .service import PersonCVQAService
from .types import CaptionResult, GeoChatConfig, VQAResult

if TYPE_CHECKING:
    from .captioning import PersonCCaptioningService


def __getattr__(name: str):
    if name == "PersonCCaptioningService":
        from .captioning import PersonCCaptioningService

        return PersonCCaptioningService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "CaptionResult",
    "GeoChatConfig",
    "PersonCCaptioningService",
    "PersonCVQAService",
    "VQAResult",
]
