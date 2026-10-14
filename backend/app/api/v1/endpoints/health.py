from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.core.config import settings
from backend.app.core.database import get_db

router = APIRouter()

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Production health check distinguishing liveness and database readiness.
    Executes SELECT 1 to verify active connection pool health without leaking credentials.
    """
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "degraded", "database": "disconnected", "error": str(e)},
        )

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENV,
        "database": db_status,
    }

