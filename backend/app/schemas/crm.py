from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

class LeadBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=10, max_length=20)
    email: Optional[EmailStr] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    target_exam: str = "JEE_ADVANCED"
    target_batch_id: Optional[str] = None
    source: str = "WALK_IN"
    estimated_fee: Optional[float] = 0.0
    follow_up_date: Optional[str] = None
    notes: Optional[str] = None

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    stage: Optional[str] = None
    follow_up_date: Optional[str] = None
    assigned_counsellor_id: Optional[str] = None
    assigned_counsellor_name: Optional[str] = None
    notes: Optional[str] = None

class LeadConvertRequest(BaseModel):
    roll_number: str = Field(..., min_length=2)
    batch_id: str
    target_exam: Optional[str] = "JEE_ADVANCED"

class LeadResponse(LeadBase):
    id: str
    organization_id: str
    stage: str
    assigned_counsellor_id: Optional[str] = None
    assigned_counsellor_name: Optional[str] = None
    converted_student_id: Optional[str] = None
    converted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
