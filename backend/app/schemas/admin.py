from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserBrief

class SystemStatsResponse(BaseModel):
    total_lost_reports: int
    total_found_reports: int
    total_returned_items: int
    active_in_custody: int
    pending_claims: int
    suggested_matches: int
    total_students: int
    total_teachers: int
    recovery_rate_percent: float
    average_resolution_days: float

class ModelHealthResponse(BaseModel):
    engine_name: str
    version: str
    status: str # "OPERATIONAL", "DEGRADED", "FALLBACK"
    feature_dimensions: int
    indexed_images_count: int
    last_inference_time_ms: float

class AuditLogResponse(BaseModel):
    id: int
    actor_user_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    timestamp: datetime
    change_metadata: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    actor: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)
