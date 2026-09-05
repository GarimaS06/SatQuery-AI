from ..schemas.response import ToolResult


def calculate_confidence(
    routing_confidence: float,
    results: list[ToolResult],
) -> float:

    if not results:
        return 0.1

    successful = sum(result.success for result in results)

    if successful == len(results):
        return routing_confidence

    if successful == 0:
        return 0.1

    return round(
        routing_confidence * (successful / len(results)),
        2,
    )