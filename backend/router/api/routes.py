from fastapi import APIRouter, Depends, HTTPException

from ..domain.models import ToolParameters
from ..rules.engine import route, validate_decision
from ..schemas.request import AnalyzeRequest
from ..schemas.response import AnalyzeResponse
from ..orchestration.executor import Executor
from ..orchestration.evidence_builder import build_evidence
from ..orchestration.confidence import calculate_confidence
from .dependencies import get_executor
from ..orchestration.answer_builder import build_answer


router = APIRouter(
    prefix="/api/router",
    tags=["router"],
)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    request: AnalyzeRequest,
    executor: Executor = Depends(get_executor),
):
    # 1. Understand the question
    try:
        decision = route(
            request.question,
            has_image2=request.image2 is not None,
        )

        validate_decision(
            decision,
            has_image2=request.image2 is not None,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    # 2. Prepare tool parameters
    params = ToolParameters(
    image_path=request.image.path,
    question=request.question,
    image2_path=request.image2.path if request.image2 else None,
    extra=request.metadata,
)

    # 3. Execute selected specialists
    execution = executor.execute(
        decision,
        params,
    )

    # 4. Collect evidence
    evidence = build_evidence(
        execution.results
    )

    # 5. Calculate confidence
    confidence = calculate_confidence(
        decision.confidence,
        execution.results,
    )
    #5.1 Build answer
    answer = build_answer(
    execution.results
)

    # 6. Determine status
    if execution.all_successful:
        status = "success"
    elif execution.all_failed:
        status = "failed"
    else:
        status = "partial"

    errors = [
        result.error
        for result in execution.failed
        if result.error
    ]

    # 7. Return normalized response
    return AnalyzeResponse(
        request_id=request.request_id,
        intent=decision.intent.value,
        tasks=[
            task.value
            for task in decision.tasks
        ],
        modality=decision.modality.value,
        tools_used=[
            result.tool
            for result in execution.successful
        ],
        results=execution.results,
        evidence=evidence,
        confidence=confidence,
        answer=answer,
        errors=errors,
        status=status,
    )