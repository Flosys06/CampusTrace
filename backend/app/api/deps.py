from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.services.auth_service import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id_str: Optional[str] = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated."
        )
    return user

def require_student_or_above(current_user: User = Depends(get_current_user)) -> User:
    """Accessible by any active user."""
    return current_user

def require_teacher_or_above(current_user: User = Depends(get_current_user)) -> User:
    """Enforces Teacher, College Admin, or Platform Admin role."""
    if current_user.role not in (UserRole.TEACHER, UserRole.COLLEGE_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Teacher or Administrator role required."
        )
    return current_user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Enforces College Admin, Platform Admin, or Admin role."""
    if current_user.role not in (UserRole.COLLEGE_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required."
        )
    return current_user

def require_platform_admin(current_user: User = Depends(get_current_user)) -> User:
    """Enforces Platform Administrator role only."""
    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Platform Administrator privileges required."
        )
    return current_user
