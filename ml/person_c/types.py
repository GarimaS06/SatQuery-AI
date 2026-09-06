"""Backward-compatibility shim — do not use for new code.

This module was renamed to ``vqa_types.py`` to avoid shadowing Python's
built-in ``types`` standard library module.  All symbols are re-exported
from ``vqa_types`` so that any existing code using the old import path
continues to work without modification.

New code should import from ``ml.person_c.vqa_types`` directly.
"""

from .vqa_types import (  # noqa: F401  (re-export)
    CaptionResult,
    GeoChatConfig,
    ImagePreparation,
    MoondreamConfig,
    VQAResult,
)

__all__ = [
    "CaptionResult",
    "GeoChatConfig",
    "ImagePreparation",
    "MoondreamConfig",
    "VQAResult",
]
