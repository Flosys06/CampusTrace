from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserBrief, UserResponse, UserCreate, UserUpdate, UserProfileUpdate
from app.services.auth_service import hash_password
from app.services.audit_service import log_audit_event
from app.api.deps import get_current_user, require_teacher_or_above, require_admin

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserBrief])
def list_directory(
    role: Optional[UserRole] = None,
    q: Optional[str] = None,
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Searchable user directory within the user's institution.
    Used by teachers to select finders, claimants, or custody recipients.
    Enforces strict tenant isolation.
    """
    query = db.query(User).filter(User.is_active == True)
    
    # Tenant isolation
    if current_user.college_id and current_user.role != UserRole.PLATFORM_ADMIN:
        query = query.filter(User.college_id == current_user.college_id)

    if role:
        query = query.filter(User.role == role)
    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(search_pattern),
                User.institutional_id.ilike(search_pattern),
                User.class_name.ilike(search_pattern),
                User.department.ilike(search_pattern)
            )
        )
    return query.limit(limit).all()

@router.patch("/me/profile", response_model=UserResponse)
def update_my_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allow authenticated student or staff member to update permitted personal profile fields.
    Identified strictly through authenticated JWT session.
    """
    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if hasattr(current_user, field):
            setattr(current_user, field, val)

    db.commit()
    db.refresh(current_user)

    log_audit_event(
        db=db,
        action="PROFILE_UPDATED",
        entity_type="USER",
        entity_id=str(current_user.id),
        actor_user_id=current_user.id,
        college_id=current_user.college_id,
        metadata={"updated_fields": list(update_dict.keys())}
    )

    return current_user

@router.get("/all-admin", response_model=List[UserResponse])
def list_users_admin(
    role: Optional[UserRole] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only comprehensive user list isolated to the college."""
    query = db.query(User)
    if current_user.college_id and current_user.role != UserRole.PLATFORM_ADMIN:
        query = query.filter(User.college_id == current_user.college_id)
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.id.desc()).all()

@router.post("", response_model=UserResponse)
def create_user_admin(
    payload: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only user creation."""
    existing = db.query(User).filter(
        or_(
            User.email == payload.email.lower(),
            User.institutional_id == payload.institutional_id.strip()
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email or institutional ID already exists."
        )

    college_id = payload.college_id or current_user.college_id

    new_user = User(
        college_id=college_id,
        institutional_id=payload.institutional_id.strip(),
        full_name=payload.full_name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        class_name=payload.class_name,
        section=payload.section,
        department=payload.department,
        is_active=payload.is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit_event(
        db=db,
        action="USER_CREATED",
        entity_type="USER",
        entity_id=str(new_user.id),
        actor_user_id=current_user.id,
        college_id=college_id,
        metadata={"institutional_id": new_user.institutional_id, "role": new_user.role.value}
    )

    return new_user

@router.patch("/{user_id}", response_model=UserResponse)
def update_user_admin(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only user modification with tenant boundary check."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_user.role != UserRole.PLATFORM_ADMIN and user.college_id != current_user.college_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify user from another college.")

    update_dict = payload.model_dump(exclude_unset=True)
    if "password" in update_dict and update_dict["password"]:
        user.password_hash = hash_password(update_dict.pop("password"))

    for k, v in update_dict.items():
        setattr(user, k, v)

    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action="USER_UPDATED",
        entity_type="USER",
        entity_id=str(user.id),
        actor_user_id=current_user.id,
        college_id=user.college_id,
        metadata={"updated_fields": list(update_dict.keys())}
    )

    return user
