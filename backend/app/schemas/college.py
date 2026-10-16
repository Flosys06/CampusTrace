from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class CollegeBase(BaseModel):
    college_code: str
    name: str
    domain: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    contact_email: Optional[str] = None

class CollegeCreate(CollegeBase):
    pass

class CollegeBrief(BaseModel):
    id: int
    college_code: str
    name: str
    domain: Optional[str] = None
    city: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class CollegeResponse(CollegeBase):
    id: int
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
