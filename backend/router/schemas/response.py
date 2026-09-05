from typing import Any

from pydantic import BaseModel, Field


class ToolResult(BaseModel):
    tool: str
    success: bool
    output: dict[str, Any] | None = None
    output_files: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    confidence: float | None = None
    error: str | None = None
    evidence: dict[str, Any] | None = None


class Evidence(BaseModel):
    tool: str
    data: dict[str, Any] = Field(default_factory=dict)


class AnalyzeResponse(BaseModel):
    request_id: str | None = None
    intent: str
    tasks: list[str]
    modality: str
    tools_used: list[str] = Field(default_factory=list)
    results: list[ToolResult] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    confidence: float | None = None
    answer: str | None = None
    errors: list[str] = Field(default_factory=list)
    status: str = "success"