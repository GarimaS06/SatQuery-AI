from dataclasses import dataclass, field
from typing import Any

from .enums import Intent, Modality, TaskType


@dataclass
class RoutingDecision:
    intent: Intent
    tasks: list[TaskType]
    modality: Modality
    matched_keywords: dict[TaskType, list[str]] = field(default_factory=dict)
    matched_rule: str = ""
    confidence: float = 0.0
    ambiguous: bool = False
    notes: list[str] = field(default_factory=list)


@dataclass
class ToolParameters:
    image_path: str
    question: str = ""
    image2_path: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)