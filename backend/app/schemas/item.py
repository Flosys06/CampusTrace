from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict
from app.schemas.category_location import CategoryResponse

class ItemImageResponse(BaseModel):
    id: int
    report_id: int
    item_id: Optional[int] = None
    storage_key: str
    original_filename: str
    mime_type: str
    file_size: int
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    is_primary: bool
    created_at: datetime
    url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ItemBase(BaseModel):
    item_name: str
    category_id: int
    visual_description: Optional[str] = None
    color: Optional[str] = None
    brand: Optional[str] = None
    distinguishing_features: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    item_name: Optional[str] = None
    category_id: Optional[int] = None
    visual_description: Optional[str] = None
    color: Optional[str] = None
    brand: Optional[str] = None
    distinguishing_features: Optional[str] = None

class ItemResponse(ItemBase):
    id: int
    report_id: int
    primary_image_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryResponse] = None
    images: List[ItemImageResponse] = []

    model_config = ConfigDict(from_attributes=True)
