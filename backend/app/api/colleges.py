from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.college import College
from app.models.user import User, UserRole
from app.schemas.college import CollegeCreate, CollegeResponse, CollegeBrief
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/colleges", tags=["Colleges / Institutions"])

@router.get("", response_model=List[CollegeBrief])
def list_active_colleges(db: Session = Depends(get_db)):
    """
    Public directory of participating institutions for registration and institutional identification.
    """
    return db.query(College).filter(College.is_active == True).order_by(College.name).all()

@router.get("/verify/{code_or_id}")
def verify_college(code_or_id: str, db: Session = Depends(get_db)):
    """
    Verifies that a college ID or code exists and is active.
    """
    ident = code_or_id.strip()
    college = db.query(College).filter(
        or_(
            College.college_code.ilike(ident),
            College.id == int(ident) if ident.isdigit() else False
        )
    ).first()

    if not college:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institution with code '{code_or_id}' was not found. Please enter a valid registered College ID."
        )

    if not college.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Institution '{college.name}' is currently inactive."
        )

    return {
        "valid": True,
        "is_valid": True,
        "college_id": college.id,
        "college_code": college.college_code,
        "name": college.name,
        "domain": college.domain
    }

@router.get("/{college_id}", response_model=CollegeResponse)
def get_college_details(
    college_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve full details of an institution.
    """
    # Authorization check: only users belonging to this college or platform admins can view
    if current_user.role != UserRole.PLATFORM_ADMIN and current_user.college_id != college_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot inspect institutional configuration for another college."
        )

    college = db.query(College).filter(College.id == college_id).first()
    if not college:
        raise HTTPException(status_code=404, detail="Institution not found")
    return college

@router.post("", response_model=CollegeResponse, status_code=status.HTTP_201_CREATED)
def create_college(
    payload: CollegeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new institution (Platform Admin only).
    """
    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform administrators can register new institutions."
        )

    existing = db.query(College).filter(
        or_(
            College.college_code == payload.college_code.upper().strip(),
            College.name == payload.name.strip()
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An institution with this code or name already exists."
        )

    college = College(
        college_code=payload.college_code.upper().strip(),
        name=payload.name.strip(),
        domain=payload.domain.strip().lower() if payload.domain else None,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        contact_email=payload.contact_email
    )
    db.add(college)
    db.commit()
    db.refresh(college)
    return college
