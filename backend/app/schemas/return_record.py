from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.return_record import VerificationMethod
from app.schemas.user import UserBrief

class ReturnRecordCreate(BaseModel):
    claim_id: int
    verification_method: VerificationMethod
    notes: Optional[str] = None

class ReturnRecordResponse(BaseModel):
    id: int
    report_id: int
    item_id: Optional[int] = None
    claim_id: int
    released_by_teacher_id: int
    collected_by_student_id: int
    verification_method: VerificationMethod
    returned_at: datetime
    notes: Optional[str] = None
    
    releasing_teacher: Optional[UserBrief] = None
    collecting_student: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)
