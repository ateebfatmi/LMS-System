from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from backend.app.core.database import get_db
from backend.app.models.crm import Lead
from backend.app.models.academic import BatchMember
from backend.app.schemas.crm import LeadCreate, LeadUpdate, LeadConvertRequest, LeadResponse
from backend.app.permissions.tenant import TenantContext, require_roles

router = APIRouter()

@router.get("/leads", response_model=List[LeadResponse])
def list_leads(
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_roles(["OWNER", "COACHING_ADMIN"])),
):
    """Retrieve all admissions leads for the authenticated tenant."""
    leads = (
        db.query(Lead)
        .filter(Lead.organization_id == tenant.organization_id)
        .order_by(Lead.created_at.desc())
        .all()
    )
    return leads

@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(
    payload: LeadCreate,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_roles(["OWNER", "COACHING_ADMIN"])),
):
    """Register a new admission inquiry."""
    lead = Lead(
        organization_id=tenant.organization_id,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        guardian_name=payload.guardian_name,
        guardian_phone=payload.guardian_phone,
        target_exam=payload.target_exam,
        target_batch_id=payload.target_batch_id,
        source=payload.source,
        estimated_fee=payload.estimated_fee,
        follow_up_date=payload.follow_up_date,
        notes=payload.notes,
        stage="NEW",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead

@router.patch("/leads/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: str,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_roles(["OWNER", "COACHING_ADMIN"])),
):
    """Update lead status or follow-up note."""
    lead = (
        db.query(Lead)
        .filter(Lead.id == lead_id, Lead.organization_id == tenant.organization_id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    if payload.stage:
        lead.stage = payload.stage
    if payload.follow_up_date:
        lead.follow_up_date = payload.follow_up_date
    if payload.assigned_counsellor_id:
        lead.assigned_counsellor_id = payload.assigned_counsellor_id
    if payload.assigned_counsellor_name:
        lead.assigned_counsellor_name = payload.assigned_counsellor_name
    if payload.notes:
        lead.notes = payload.notes

    db.commit()
    db.refresh(lead)
    return lead

@router.post("/leads/{lead_id}/convert", response_model=LeadResponse)
def convert_lead_to_student(
    lead_id: str,
    payload: LeadConvertRequest,
    db: Session = Depends(get_db),
    tenant: TenantContext = Depends(require_roles(["OWNER", "COACHING_ADMIN"])),
):
    """
    1-Click conversion of a qualified lead into an enrolled student.
    Ensures safe transaction, sets roll number, and prevents duplicate conversions.
    """
    lead = (
        db.query(Lead)
        .filter(Lead.id == lead_id, Lead.organization_id == tenant.organization_id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    if lead.stage == "CONVERTED" and lead.converted_student_id:
        raise HTTPException(status_code=400, detail="This lead has already been converted.")

    student_user_id = f"usr-{payload.roll_number.lower().replace('-', '_')}"
    
    # Check if student already enrolled in batch to prevent duplicates
    existing_member = (
        db.query(BatchMember)
        .filter(BatchMember.batch_id == payload.batch_id, BatchMember.user_id == student_user_id)
        .first()
    )
    if not existing_member:
        new_member = BatchMember(
            batch_id=payload.batch_id,
            user_id=student_user_id,
            role="STUDENT",
            roll_number=payload.roll_number,
        )
        db.add(new_member)

    lead.stage = "CONVERTED"
    lead.converted_student_id = student_user_id
    lead.converted_at = datetime.now(timezone.utc)
    lead.target_batch_id = payload.batch_id

    db.commit()
    db.refresh(lead)
    return lead
