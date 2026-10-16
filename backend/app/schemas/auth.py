from pydantic import BaseModel
from typing import Optional
from app.models.user import UserRole

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int
    institutional_id: str
    student_id_usn: Optional[str] = None
    full_name: str
    email: str
    college_id: Optional[int] = None
    college_code: Optional[str] = None
    college_name: Optional[str] = None

class TokenData(BaseModel):
    sub: Optional[str] = None
    role: Optional[UserRole] = None
    college_id: Optional[int] = None

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str
