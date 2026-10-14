from fastapi import APIRouter, HTTPException, Depends
from backend.app.schemas.assessment import (
    EvaluationRequest,
    EvaluationResponse,
)
from backend.app.services.assessment_service import evaluate_test_submission
from backend.app.permissions.tenant import TenantContext, get_tenant_context

router = APIRouter()

@router.post("/evaluate", response_model=EvaluationResponse)
def evaluate_exam(
    payload: EvaluationRequest,
    tenant: TenantContext = Depends(get_tenant_context),
):
    """
    Authoritative backend evaluation engine for CBT mock tests.
    Calculates marks, negative penalties, JEE Advanced partial credits, and accuracy.
    Enforces that answer keys and score calculations occur on the server.
    """
    if not payload.questions:
        raise HTTPException(status_code=400, detail="Cannot evaluate test with zero questions.")

    return evaluate_test_submission(payload.questions, payload.submissions)
