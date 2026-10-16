from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.models.match import MatchStatus
from app.schemas.user import UserBrief

class MatchReviewRequest(BaseModel):
    match_status: MatchStatus # CONFIRMED or REJECTED
    notes: Optional[str] = None

class MatchExplanation(BaseModel):
    visual_similarity_percent: float
    category_match: bool
    color_match: bool
    temporal_proximity_days: Optional[int] = None
    location_proximity: Optional[str] = None
    summary: str

class MatchResponse(BaseModel):
    id: int
    lost_report_id: int
    found_report_id: int
    similarity_score: float
    visual_score: float
    metadata_score: float
    matching_model_version: str
    matching_features: Optional[Dict[str, Any]] = None
    match_status: MatchStatus
    reviewed_by_user_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    
    # Nested brief representation
    lost_report_summary: Optional[Dict[str, Any]] = None
    found_report_summary: Optional[Dict[str, Any]] = None
    reviewer: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)
