import secrets

from fastapi import Header, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.core.database import get_db
from backend.app.models.organization import Institute, InstituteMember
from backend.app.core.config import settings

class TenantContext:
    def __init__(self, organization_id: str, user_id: str, role: str):
        self.organization_id = organization_id
        self.user_id = user_id
        self.role = role

def get_tenant_context(
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-ID"),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    x_internal_api_key: Optional[str] = Header(None, alias="X-Internal-API-Key"),
    db: Session = Depends(get_db),
) -> TenantContext:
    """
    Resolves tenant context securely.
    Verifies that the authenticated user actually owns or is an active member of the organization.
    Never trusts client headers without server-side database validation.
    """
    if not settings.INTERNAL_API_KEY or not x_internal_api_key or not secrets.compare_digest(
        x_internal_api_key,
        settings.INTERNAL_API_KEY,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorised internal service request.",
        )

    if not x_user_id or not x_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated user and organization context are required.",
        )

    user_id = x_user_id
    org_id = x_organization_id

    # Query institute
    institute = db.query(Institute).filter(Institute.id == org_id, Institute.status == "ACTIVE").first()
    
    # Strictly reject non-existent or inactive organizations
    if not institute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization '{org_id}' not found or is currently inactive.",
        )

    # Check if user is owner
    if institute.owner_user_id == user_id:
        return TenantContext(organization_id=org_id, user_id=user_id, role="OWNER")

    # Check active membership
    membership = (
        db.query(InstituteMember)
        .filter(
            InstituteMember.institute_id == org_id,
            InstituteMember.user_id == user_id,
            InstituteMember.status == "ACTIVE",
        )
        .first()
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You are not an active member of this organization.",
        )

    return TenantContext(organization_id=org_id, user_id=user_id, role=membership.role)

def require_roles(allowed_roles: List[str]):
    def role_checker(context: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if context.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Action requires one of roles: {allowed_roles}",
            )
        return context
    return role_checker
