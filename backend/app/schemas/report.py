from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict
from app.models.report import ReportType, ReportStatus, ReportPriority
from app.schemas.user import UserBrief
from app.schemas.college import CollegeBrief
from app.schemas.category_location import CampusLocationResponse
from app.schemas.item import ItemResponse, ItemImageResponse

class ReportCreate(BaseModel):
    report_type: ReportType
    item_name: str
    category_id: int
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    manual_campus_location: Optional[str] = None
    handed_over_teacher_name: Optional[str] = None
    report_date: date
    approximate_event_time: Optional[str] = None
    detailed_description: str
    
    # Item characteristics
    visual_description: Optional[str] = None
    color: Optional[str] = None
    brand: Optional[str] = None
    distinguishing_features: Optional[str] = None
    
    # Found Report Specifics (Teacher / Authorized workflow)
    reported_found_by_student_id: Optional[int] = None # The student who physically found and handed it over
    reported_lost_by_student_id: Optional[int] = None  # If student reported losing it
    storage_location_id: Optional[int] = None          # Where item is initially placed
    confirm_physical_receipt: bool = False             # Set to True only if teacher physically has the item
    priority: Optional[ReportPriority] = ReportPriority.NORMAL

class ReportUpdate(BaseModel):
    status: Optional[ReportStatus] = None
    priority: Optional[ReportPriority] = None
    detailed_description: Optional[str] = None
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    manual_campus_location: Optional[str] = None
    handed_over_teacher_name: Optional[str] = None
    approximate_event_time: Optional[str] = None

class ReportCloseRequest(BaseModel):
    reason: str # "No longer needed", "Item found elsewhere", "Duplicate report", "Other"
    notes: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    college_id: Optional[int] = None
    report_number: str
    report_type: ReportType
    status: ReportStatus
    priority: ReportPriority
    report_date: date
    approximate_event_time: Optional[str] = None
    detailed_description: str
    manual_campus_location: Optional[str] = None
    handed_over_teacher_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_type: Optional[str] = None
    resolution_notes: Optional[str] = None
    
    # Foreign Keys
    submitted_by_student_id: Optional[int] = None
    reported_lost_by_student_id: Optional[int] = None
    reported_found_by_student_id: Optional[int] = None
    created_by_user_id: int
    received_by_teacher_id: Optional[int] = None
    location_id: Optional[int] = None
    
    # Associated Entities
    college: Optional[CollegeBrief] = None
    location: Optional[CampusLocationResponse] = None
    creator: Optional[UserBrief] = None
    submitting_student: Optional[UserBrief] = None
    lost_student: Optional[UserBrief] = None
    finder_student: Optional[UserBrief] = None
    receiving_teacher: Optional[UserBrief] = None
    
    item: Optional[ItemResponse] = None
    images: List[ItemImageResponse] = []
    
    matches_count: Optional[int] = 0
    claims_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

class ReportListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[ReportResponse]
