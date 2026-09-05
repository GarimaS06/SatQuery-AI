from typing import Any
from ..schemas.response import ToolResult


def map_analysis_result(analysis: Any, tool_name: str) -> ToolResult:
    output = {
        "analysis_type": analysis.analysis_type,
        "result": analysis.result,
        "metadata": analysis.metadata,
    }

    return ToolResult(
        tool=tool_name,
        success=analysis.success,
        output=output,
        evidence=analysis.evidence,
        output_files=analysis.output_files,
        warnings=analysis.warnings,
        error=analysis.error,
    )