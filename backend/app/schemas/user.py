from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel, ConfigDict
from app.models.user import UserRole
from app.schemas.college import CollegeBrief

class UserBase(BaseModel):
    institutional_id: str
    full_name: str
    email: str
    role: UserRole
    college_id: Optional[int] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    department: Optional[str] = None
    student_id_usn: Optional[str] = None
    year_of_study: Optional[Union[str, int]] = None
    semester: Optional[Union[str, int]] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    privacy_hide_contact: bool = True
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserRegisterRequest(BaseModel):
    college_code: str
    full_name: str
    email: str
    password: str
    institutional_id: Optional[str] = None
    student_id_usn: Optional[str] = None
    department: Optional[str] = None
    year_of_study: Optional[Union[str, int]] = None
    semester: Optional[Union[str, int]] = None
    phone_number: Optional[str] = None

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    department: Optional[str] = None
    class_name: Optional[str] = None
    student_id_usn: Optional[str] = None
    year_of_study: Optional[Union[str, int]] = None
    semester: Optional[Union[str, int]] = None
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    privacy_hide_contact: Optional[bool] = None

class ForgotPasswordRequest(BaseModel):
    email: Optional[str] = None
    identifier: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    reset_token: Optional[str] = None
    token: Optional[str] = None
    new_password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserBrief(BaseModel):
    id: int
    institutional_id: str
    full_name: str
    role: UserRole
    college_id: Optional[int] = None
    department: Optional[str] = None
    class_name: Optional[str] = None
    year_of_study: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class UserResponse(UserBase):
    id: int
    college: Optional[CollegeBrief] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
