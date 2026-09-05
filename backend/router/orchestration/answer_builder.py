from ..schemas.response import ToolResult


def build_answer(results: list[ToolResult]) -> str | None:
    if not results:
        return None

    successful = [
        result for result in results
        if result.success
    ]

    failed = [
        result for result in results
        if not result.success
    ]

    parts = []

    for result in successful:
        parts.append(
            _format_success(result)
        )

    for result in failed:
        if result.error:
            parts.append(
                f"{result.tool.upper()} analysis failed: "
                f"{result.error}"
            )

    return " ".join(parts) if parts else None


def _format_success(result: ToolResult) -> str:
    output = result.output or {}

    # VQA: return the actual answer from Person C
    if result.tool == "vqa":
        answer = output.get("answer")
        if answer:
            return answer

    # Captioning: return the actual caption from Person C
    if result.tool == "captioning":
        caption = output.get("caption")
        if caption:
            return caption

    analysis_type = output.get("analysis_type", result.tool)
    analysis_result = output.get("result", {})

    if isinstance(analysis_result, dict):
        values = []
        for key, value in analysis_result.items():
            if isinstance(value, (int, float)):
                values.append(
                    f"{key.replace('_', ' ')}: {value}"
                )

        if values:
            return (
                f"{analysis_type.upper()} analysis completed successfully. "
                + ", ".join(values)
                + "."
            )

    return f"{analysis_type.upper()} analysis completed successfully."