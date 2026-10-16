from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.custody import HandoverStatus
from app.schemas.user import UserBrief
from app.schemas.category_location import StorageLocationResponse

class HandoverConfirmRequest(BaseModel):
    storage_location_id: int
    handover_notes: Optional[str] = None
    finder_student_id: Optional[int] = None # When teacher verifies student handover

class CustodyTransferRequest(BaseModel):
    new_custodian_id: int
    storage_location_id: Optional[int] = None
    handover_notes: Optional[str] = None

class CustodyRecordResponse(BaseModel):
    id: int
    report_id: int
    item_id: Optional[int] = None
    previous_custodian_id: Optional[int] = None
    new_custodian_id: int
    transferred_by_user_id: int
    received_by_user_id: Optional[int] = None
    storage_location_id: Optional[int] = None
    handover_status: HandoverStatus
    handover_notes: Optional[str] = None
    transferred_at: datetime
    acknowledged_at: Optional[datetime] = None
    
    previous_custodian: Optional[UserBrief] = None
    new_custodian: Optional[UserBrief] = None
    transferred_by: Optional[UserBrief] = None
    received_by: Optional[UserBrief] = None
    storage_location: Optional[StorageLocationResponse] = None

    model_config = ConfigDict(from_attributes=True)
