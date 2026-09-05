from typing import Any

from pydantic import BaseModel, Field


class ImageRef(BaseModel):
    filename: str
    path: str
    format: str
    width: int
    height: int
    size_bytes: int | None = None


class AnalyzeRequest(BaseModel):
    request_id: str | None = None
    question: str = Field(min_length=1)
    image: ImageRef
    image2: ImageRef | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)