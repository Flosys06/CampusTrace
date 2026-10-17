from pydantic import BaseModel, Field
from typing import List, Optional

class NinjaBoundingBox(BaseModel):
    x1: float = Field(..., description="Top-left X coordinate")
    y1: float = Field(..., description="Top-left Y coordinate")
    x2: float = Field(..., description="Bottom-right X coordinate")
    y2: float = Field(..., description="Bottom-right Y coordinate")

class NinjaDetectedItem(BaseModel):
    label: str = Field(..., description="Detected object label (e.g. backpack, laptop, cell phone)")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0")
    bounding_box: Optional[NinjaBoundingBox] = Field(None, description="Bounding box coordinates in pixels")
    suggested_category: Optional[str] = Field(None, description="Mapped CampusTrace category name")

class NinjaDetectionResponse(BaseModel):
    success: bool = True
    count: int = Field(..., description="Number of objects detected")
    detected_objects: List[NinjaDetectedItem] = Field(default_factory=list)
    top_label: Optional[str] = Field(None, description="Highest-confidence detected object")
    top_confidence: Optional[float] = Field(None, description="Highest confidence score")
    suggested_category: Optional[str] = Field(None, description="Suggested campus category")
    suggested_title: Optional[str] = Field(None, description="Autofill title suggestion")
    suggested_description: Optional[str] = Field(None, description="Autofill description suggestion")
    provider: str = Field("API Ninjas Object Detection", description="Inference engine provider")

class FoundMatchCandidate(BaseModel):
    report_id: int
    report_number: str
    item_name: str
    category_name: str
    color: Optional[str] = None
    location_name: str
    report_date: str
    status: str
    handed_over_teacher_name: Optional[str] = None
    primary_image_key: Optional[str] = None
    confidence_score: float = Field(..., description="Calculated match percentage (0.0 to 1.0)")
    match_reasons: List[str] = Field(default_factory=list)
    detailed_description: Optional[str] = None

class ScanMatchResponse(BaseModel):
    success: bool = True
    detected_label: str
    detected_confidence: float
    detected_category: str
    detected_color: str
    matches_count: int
    matches: List[FoundMatchCandidate] = Field(default_factory=list)

class AlertTeacherRequest(BaseModel):
    found_report_id: int
    claim_notes: Optional[str] = "Student identified item via photo scan matching."

class AlertTeacherResponse(BaseModel):
    success: bool = True
    claim_id: int
    report_id: int
    report_number: str
    teacher_name: Optional[str] = None
    message: str
    pickup_instructions: str
