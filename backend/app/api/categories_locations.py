from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.user import User, UserRole
from app.models.category_location import Category, CampusLocation, StorageLocation
from app.schemas.category_location import (
    CategoryResponse, CategoryCreate, CategoryUpdate,
    CampusLocationResponse, CampusLocationCreate, CampusLocationUpdate,
    StorageLocationResponse, StorageLocationCreate, StorageLocationUpdate
)
from app.api.deps import get_current_user, require_teacher_or_above, require_admin

router = APIRouter(tags=["Categories & Locations"])

# --- Categories ---
@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """List all active item categories."""
    return db.query(Category).filter(Category.is_active == True).order_by(Category.name.asc()).all()

@router.post("/categories", response_model=CategoryResponse)
def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only: Create item category."""
    existing = db.query(Category).filter(Category.name.ilike(payload.name.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    cat = Category(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

# --- Campus Discovery Locations ---
@router.get("/campus-locations", response_model=List[CampusLocationResponse])
def get_campus_locations(
    college_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List campus locations where items can be lost or found.
    Isolated by authenticated user's institution.
    """
    query = db.query(CampusLocation).filter(CampusLocation.is_active == True)
    
    target_college_id = college_id or current_user.college_id
    if target_college_id and current_user.role != UserRole.PLATFORM_ADMIN:
        query = query.filter(
            or_(
                CampusLocation.college_id == target_college_id,
                CampusLocation.college_id == None
            )
        )
    return query.order_by(CampusLocation.name.asc()).all()

@router.post("/campus-locations", response_model=CampusLocationResponse)
def create_campus_location(
    payload: CampusLocationCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only: Create campus location scoped to the institution."""
    loc_dict = payload.model_dump()
    if not loc_dict.get("college_id"):
        loc_dict["college_id"] = current_user.college_id

    loc = CampusLocation(**loc_dict)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

# --- Storage Locations (Chain of Custody) ---
@router.get("/storage-locations", response_model=List[StorageLocationResponse])
def get_storage_locations(
    current_user: User = Depends(require_teacher_or_above),
    db: Session = Depends(get_db)
):
    """Staff-only: View secure storage facilities (cabinets, safes, lockers) scoped to the college."""
    query = db.query(StorageLocation).filter(StorageLocation.is_active == True)
    if current_user.college_id and current_user.role != UserRole.PLATFORM_ADMIN:
        query = query.filter(
            or_(
                StorageLocation.college_id == current_user.college_id,
                StorageLocation.college_id == None
            )
        )
    return query.all()

@router.post("/storage-locations", response_model=StorageLocationResponse)
def create_storage_location(
    payload: StorageLocationCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin-only: Register new secure storage location."""
    storage_dict = payload.model_dump()
    if not storage_dict.get("college_id"):
        storage_dict["college_id"] = current_user.college_id

    storage = StorageLocation(**storage_dict)
    db.add(storage)
    db.commit()
    db.refresh(storage)
    return storage
