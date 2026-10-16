from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserBrief

# Categories
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "tag"
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Campus Locations
class CampusLocationBase(BaseModel):
    name: str
    building: str
    college_id: Optional[int] = None
    floor: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class CampusLocationCreate(CampusLocationBase):
    pass

class CampusLocationUpdate(BaseModel):
    name: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CampusLocationResponse(CampusLocationBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Storage Locations (Chain of custody)
class StorageLocationBase(BaseModel):
    name: str
    building: str
    room_number: str
    college_id: Optional[int] = None
    locker_box_identifier: Optional[str] = None
    custodian_teacher_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: bool = True

class StorageLocationCreate(StorageLocationBase):
    pass

class StorageLocationUpdate(BaseModel):
    name: Optional[str] = None
    building: Optional[str] = None
    room_number: Optional[str] = None
    locker_box_identifier: Optional[str] = None
    custodian_teacher_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class StorageLocationResponse(StorageLocationBase):
    id: int
    created_at: datetime
    custodian: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)
