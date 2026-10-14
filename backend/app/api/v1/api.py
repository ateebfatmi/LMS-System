from fastapi import APIRouter
from backend.app.api.v1.endpoints import health, crm, assessments, webhooks

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(crm.router, prefix="/crm", tags=["Admissions CRM"])
api_router.include_router(assessments.router, prefix="/assessments", tags=["Assessments & CBT"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks & Payments"])
