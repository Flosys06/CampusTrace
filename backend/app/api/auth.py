from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.user import User, UserRole
from app.models.college import College
from app.schemas.auth import LoginRequest, Token, PasswordChangeRequest
from app.schemas.user import (
    UserResponse,
    UserRegisterRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest
)
from app.services.auth_service import (
    verify_password,
    hash_password,
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token
)
from app.services.audit_service import log_audit_event
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_student(
    request: Request,
    payload: UserRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new student account under a valid, verified College ID.
    Enforces institutional membership validation.
    """
    college_code = payload.college_code.strip().upper()
    college = db.query(College).filter(College.college_code == college_code).first()
    if not college:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid College ID / Code '{payload.college_code}'. You must belong to an authorized institution."
        )

    if not college.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Institution '{college.name}' is currently inactive for new registrations."
        )

    email = payload.email.strip().lower()
    inst_id = (payload.institutional_id or payload.student_id_usn or "").strip()
    if not inst_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student ID or USN is required."
        )

    # Check email uniqueness
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in."
        )

    # Check institutional ID uniqueness within this college
    if db.query(User).filter(User.institutional_id == inst_id, User.college_id == college.id).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student ID / USN '{inst_id}' is already registered in {college.name}."
        )

    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    user = User(
        college_id=college.id,
        institutional_id=inst_id,
        student_id_usn=inst_id,
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=UserRole.STUDENT,
        department=payload.department.strip() if payload.department else None,
        year_of_study=str(payload.year_of_study).strip() if payload.year_of_study else None,
        semester=str(payload.semester).strip() if payload.semester else None,
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit_event(
        db=db,
        action="REGISTRATION_SUCCESS",
        entity_type="USER",
        entity_id=str(user.id),
        actor_user_id=user.id,
        college_id=college.id,
        metadata={"college_code": college.college_code, "role": user.role.value},
        ip_address=request.client.host if request.client else None
    )

    token = create_access_token(
        user_id=user.id,
        institutional_id=user.institutional_id,
        role=user.role,
        college_id=college.id
    )

    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        institutional_id=user.institutional_id,
        student_id_usn=user.student_id_usn or user.institutional_id,
        full_name=user.full_name,
        email=user.email,
        college_id=college.id,
        college_code=college.college_code,
        college_name=college.name
    )

@router.post("/login", response_model=Token)
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user via institutional ID or email and password.
    Returns signed JWT access token with tenant context.
    """
    ident = payload.username_or_email.strip()
    user = db.query(User).filter(
        or_(
            User.email == ident.lower(),
            User.institutional_id == ident
        )
    ).first()

    if not user or not verify_password(payload.password, user.password_hash):
        log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            entity_type="AUTH",
            entity_id=ident,
            actor_user_id=None,
            metadata={"identifier": ident},
            ip_address=request.client.host if request.client else None
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect institutional ID / email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact campus admin."
        )

    college = user.college
    college_id = college.id if college else user.college_id
    college_code = college.college_code if college else None
    college_name = college.name if college else None

    token = create_access_token(
        user_id=user.id,
        institutional_id=user.institutional_id,
        role=user.role,
        college_id=college_id
    )

    log_audit_event(
        db=db,
        action="LOGIN_SUCCESS",
        entity_type="USER",
        entity_id=str(user.id),
        actor_user_id=user.id,
        college_id=college_id,
        metadata={"role": user.role.value, "college_id": college_id},
        ip_address=request.client.host if request.client else None
    )

    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        institutional_id=user.institutional_id,
        student_id_usn=user.student_id_usn or user.institutional_id,
        full_name=user.full_name,
        email=user.email,
        college_id=college_id,
        college_code=college_code,
        college_name=college_name
    )

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns authenticated user profile details."""
    return current_user

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Initiates secure password reset for a student or staff member.
    """
    ident = (payload.email or payload.identifier or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Email or Student ID is required.")

    user = db.query(User).filter(
        or_(
            User.email == ident.lower(),
            User.institutional_id == ident
        )
    ).first()

    if not user:
        # Avoid user enumeration by returning standard response
        return {
            "message": "If an account matching that identifier exists, a password reset token has been issued.",
            "reset_token": None
        }

    reset_token = create_password_reset_token(user.id)
    log_audit_event(
        db=db,
        action="PASSWORD_RESET_REQUESTED",
        entity_type="USER",
        entity_id=str(user.id),
        actor_user_id=user.id,
        college_id=user.college_id
    )
    return {
        "message": "Password reset token generated successfully. Please enter your new password.",
        "reset_token": reset_token
    }

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Completes password reset using verified reset token.
    """
    token_str = payload.reset_token or payload.token
    if not token_str:
        raise HTTPException(status_code=400, detail="Reset token is required.")

    user_id = decode_password_reset_token(token_str)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token is invalid or has expired (valid for 15 minutes). Please request a new one."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    log_audit_event(
        db=db,
        action="PASSWORD_RESET_COMPLETED",
        entity_type="USER",
        entity_id=str(user.id),
        actor_user_id=user.id,
        college_id=user.college_id
    )
    return {
        "success": True,
        "message": "Password reset successfully. You may now log in with your new password."
    }

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Logs out user and registers audit event."""
    log_audit_event(
        db=db,
        action="LOGOUT",
        entity_type="USER",
        entity_id=str(current_user.id),
        actor_user_id=current_user.id,
        college_id=current_user.college_id
    )
    return {"message": "Successfully logged out"}

@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allows user to change their account password."""
    if not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed."
        )
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    log_audit_event(
        db=db,
        action="PASSWORD_CHANGED",
        entity_type="USER",
        entity_id=str(current_user.id),
        actor_user_id=current_user.id,
        college_id=current_user.college_id
    )
    return {"message": "Password updated successfully."}
