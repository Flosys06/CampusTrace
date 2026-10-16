from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.models.claim import ClaimStatus
from app.schemas.user import UserBrief

class ClaimCreate(BaseModel):
    claim_description: str
    private_ownership_evidence: str
    linked_lost_report_id: Optional[int] = None

class ClaimReviewRequest(BaseModel):
    status: ClaimStatus # APPROVED or REJECTED
    review_notes: Optional[str] = None

class ClaimResponse(BaseModel):
    id: int
    found_report_id: int
    claimant_student_id: int
    linked_lost_report_id: Optional[int] = None
    claim_description: str
    private_ownership_evidence: Optional[str] = None # Sanitized based on caller permissions
    status: ClaimStatus
    reviewed_by_teacher_id: Optional[int] = None
    review_notes: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    
    claimant: Optional[UserBrief] = None
    reviewer: Optional[UserBrief] = None
    found_report_summary: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)
