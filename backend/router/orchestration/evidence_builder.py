from ..schemas.response import Evidence, ToolResult


def build_evidence(results: list[ToolResult]) -> list[Evidence]:
    evidence = []

    for result in results:
        if result.success and result.evidence:
            evidence.append(
                Evidence(
                    tool=result.tool,
                    data=result.evidence,
                )
            )

    return evidence