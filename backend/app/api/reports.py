import uuid
import logging
from datetime import datetime, date, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from app.database import get_db
from app.models.user import User, UserRole
from app.models.report import Report, ReportType, ReportStatus, ReportPriority
from app.models.item import Item, ItemImage
from app.models.custody import CustodyRecord, HandoverStatus
from app.models.category_location import StorageLocation
from app.schemas.report import ReportCreate, ReportUpdate, ReportResponse, ReportListResponse, ReportCloseRequest
from app.schemas.item import ItemImageResponse
from app.schemas.match import MatchResponse
from app.services.storage_service import storage_service
from app.services.vision_extractor import vision_extractor
from app.services.matching_engine import matching_engine
from app.services.audit_service import log_audit_event
from app.api.deps import get_current_user, require_teacher_or_above

logger = logging.getLogger("campustrace.reports")
router = APIRouter(prefix="/reports", tags=["Reports"])

def generate_report_number(db: Session, report_type: ReportType) -> str:
    """Generates unique human-readable report number (e.g., TRC-L-2026-0042)."""
    prefix = "L" if report_type == ReportType.LOST else "F"
    current_year = datetime.now(timezone.utc).year
    count = db.query(Report).filter(Report.report_type == report_type).count() + 1
    return f"TRC-{prefix}-{current_year}-{count:04d}"

@router.post("", response_model=ReportResponse)
def create_report(
    payload: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit a Lost or Found item report.
    - Students can submit LOST reports (or FOUND reports requiring teacher custody confirmation).
    - Teachers can register FOUND items with physical custody confirmation & storage location assignment.
    """
    # Authorization checks
    if payload.report_type == ReportType.FOUND and current_user.role == UserRole.STUDENT:
        # If student registers found item, it starts in PENDING_HANDOVER until received by staff
        payload.confirm_physical_receipt = False
        payload.storage_location_id = None

    report_num = generate_report_number(db, payload.report_type)
    
    # Determine initial status
    if payload.report_type == ReportType.LOST:
        initial_status = ReportStatus.OPEN
        received_teacher_id = None
    else:
        # FOUND report
        if payload.confirm_physical_receipt and current_user.role in (UserRole.TEACHER, UserRole.ADMIN):
            initial_status = ReportStatus.IN_CUSTODY
            received_teacher_id = current_user.id
        else:
            initial_status = ReportStatus.PENDING_HANDOVER
            received_teacher_id = current_user.id if current_user.role in (UserRole.TEACHER, UserRole.ADMIN) else None

    # Determine student attribution
    submitting_student_id = current_user.id if current_user.role == UserRole.STUDENT else None
    lost_student_id = current_user.id if payload.report_type == ReportType.LOST and current_user.role == UserRole.STUDENT else payload.reported_lost_by_student_id
    finder_student_id = payload.reported_found_by_student_id or (current_user.id if payload.report_type == ReportType.FOUND and current_user.role == UserRole.STUDENT else None)

    # Multi-tenant isolation: Determine college_id
    college_id = current_user.college_id
    if not college_id and current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is not associated with an institution. Please update your profile or contact administrator."
        )

    report = Report(
        report_number=report_num,
        report_type=payload.report_type,
        college_id=college_id,
        submitted_by_student_id=submitting_student_id,
        reported_lost_by_student_id=lost_student_id,
        reported_found_by_student_id=finder_student_id,
        created_by_user_id=current_user.id,
        received_by_teacher_id=received_teacher_id,
        report_date=payload.report_date,
        approximate_event_time=payload.approximate_event_time,
        location_id=payload.location_id,
        detailed_description=payload.detailed_description,
        status=initial_status,
        priority=payload.priority or ReportPriority.NORMAL
    )
    db.add(report)
    db.flush()

    # Create associated Item record
    item = Item(
        report_id=report.id,
        item_name=payload.item_name,
        category_id=payload.category_id,
        visual_description=payload.visual_description or payload.detailed_description,
        color=payload.color,
        brand=payload.brand,
        distinguishing_features=payload.distinguishing_features
    )
    db.add(item)
    db.flush()

    # If physical handover is verified immediately by teacher, record custody entry
    if initial_status == ReportStatus.IN_CUSTODY:
        custody_entry = CustodyRecord(
            report_id=report.id,
            item_id=item.id,
            previous_custodian_id=finder_student_id,
            new_custodian_id=current_user.id,
            transferred_by_user_id=current_user.id,
            received_by_user_id=current_user.id,
            storage_location_id=payload.storage_location_id,
            handover_status=HandoverStatus.CONFIRMED,
            handover_notes=f"Initial physical intake confirmed by {current_user.full_name}. Received from student ID {finder_student_id or 'anonymous finder'}.",
            transferred_at=datetime.utcnow(),
            acknowledged_at=datetime.utcnow()
        )
        db.add(custody_entry)

    db.commit()
    db.refresh(report)

    # Audit log entry
    log_audit_event(
        db=db,
        action="REPORT_CREATED",
        entity_type="REPORT",
        entity_id=str(report.id),
        actor_user_id=current_user.id,
        metadata={
            "report_number": report.report_number,
            "type": report.report_type.value,
            "item_name": item.item_name,
            "status": report.status.value
        }
    )

    # Run AI matching against existing opposite reports (metadata pass)
    try:
        matching_engine.find_and_save_matches_for_report(db, report)
    except Exception:
        pass

    db.refresh(report)
    return report

@router.get("", response_model=ReportListResponse)
def list_reports(
    report_type: Optional[ReportType] = None,
    category_id: Optional[int] = None,
    location_id: Optional[int] = None,
    status_filter: Optional[ReportStatus] = Query(None, alias="status"),
    my_reports: bool = False,
    awaiting_handover: bool = False,
    search: Optional[str] = None,
    college_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search and filter reports with pagination.
    Supports filtering by role, status, category, location, and keywords.
    Enforces strict college tenant isolation.
    """
    query = db.query(Report)

    # Multi-tenant isolation filter
    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if current_user.college_id:
            query = query.filter(Report.college_id == current_user.college_id)
        else:
            query = query.filter(Report.college_id.is_(None))
    elif college_id:
        query = query.filter(Report.college_id == college_id)

    if report_type:
        query = query.filter(Report.report_type == report_type)

    if status_filter:
        query = query.filter(Report.status == status_filter)
    elif awaiting_handover:
        query = query.filter(Report.status == ReportStatus.PENDING_HANDOVER)

    if category_id:
        query = query.join(Report.item).filter(Item.category_id == category_id)

    if location_id:
        query = query.filter(Report.location_id == location_id)

    if my_reports:
        # Returns reports submitted, reported lost, or reported found by this user
        query = query.filter(
            or_(
                Report.created_by_user_id == current_user.id,
                Report.submitted_by_student_id == current_user.id,
                Report.reported_lost_by_student_id == current_user.id,
                Report.reported_found_by_student_id == current_user.id,
                Report.received_by_teacher_id == current_user.id
            )
        )

    if search:
        pattern = f"%{search.strip()}%"
        query = query.outerjoin(Report.item).filter(
            or_(
                Report.report_number.ilike(pattern),
                Report.detailed_description.ilike(pattern),
                Item.item_name.ilike(pattern),
                Item.color.ilike(pattern),
                Item.brand.ilike(pattern),
                Item.distinguishing_features.ilike(pattern)
            )
        )

    total = query.count()
    items = query.order_by(desc(Report.created_at)).offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size

    # Attach counts
    for rep in items:
        rep.matches_count = len(rep.lost_matches) if rep.report_type == ReportType.LOST else len(rep.found_matches)
        rep.claims_count = len(rep.claims)

    return ReportListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items
    )

@router.get("/{report_id}", response_model=ReportResponse)
def get_report_detail(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve full details of a specific report with tenant verification."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Report belongs to another institution")

    report.matches_count = len(report.lost_matches) if report.report_type == ReportType.LOST else len(report.found_matches)
    report.claims_count = len(report.claims)
    return report

@router.patch("/{report_id}", response_model=ReportResponse)
def update_report(
    report_id: int,
    payload: ReportUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update report details.
    Only authorized teachers/admins or original creators (for non-status edits) may update.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Report belongs to another institution")

    is_staff = current_user.role in (UserRole.TEACHER, UserRole.COLLEGE_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.ADMIN)
    is_owner = report.created_by_user_id == current_user.id

    if not is_staff and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to edit this report")

    # Only staff can modify status or priority
    if (payload.status or payload.priority) and not is_staff:
        raise HTTPException(status_code=403, detail="Students cannot change report status or priority")

    update_dict = payload.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(report, k, v)

    db.commit()
    db.refresh(report)

    log_audit_event(
        db=db,
        action="REPORT_UPDATED",
        entity_type="REPORT",
        entity_id=str(report.id),
        actor_user_id=current_user.id,
        metadata={"updated_fields": list(update_dict.keys())}
    )

@router.post("/analyze-image")
async def analyze_image_preview(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mobile Camera AI Analysis:
    Pre-processes captured photograph, extracts visual features & dominant color,
    and returns editable AI suggestions for category, likely item name, and description.
    """
    from app.models.category_location import Category
    storage_key, mime_type, file_size, width, height = await storage_service.save_image(file)
    file_path = storage_service.get_file_path(storage_key)

    features = None
    try:
        features = vision_extractor.extract_features(file_path)
    except Exception as e:
        features = {
            "embedding": [0.0] * 512,
            "primary_color": "Multi-color",
            "model_version": "CampusTrace-Vision-Fallback",
            "error": str(e)
        }

    dominant_color = features.get("primary_color", "Unknown") if features else "Unknown"
    aspect_ratio = features.get("aspect_ratio", 1.0) if features else 1.0

    # Real Deep Learning Computer Vision Object Recognition (MobileNetV2 ONNX)
    from app.services.campus_classifier import campus_classifier
    ai_classification = campus_classifier.predict(file_path, primary_color=dominant_color)

    # Match closest category from DB
    categories = db.query(Category).filter(Category.is_active == True).all()
    suggested_category = None
    target_cat_name = ai_classification.get("suggested_category_name", "").lower()

    if target_cat_name:
        suggested_category = next(
            (c for c in categories if c.name.lower() in target_cat_name or target_cat_name in c.name.lower()),
            None
        )

    if not suggested_category and categories:
        suggested_category = categories[0]

    cat_name = suggested_category.name if suggested_category else "Other Belongings"

    return {
        "storage_key": storage_key,
        "primary_color": dominant_color,
        "suggested_category_id": suggested_category.id if suggested_category else None,
        "suggested_category_name": cat_name,
        "suggested_item_name": ai_classification.get("suggested_item_name", f"{dominant_color} {cat_name}"),
        "suggested_description": ai_classification.get("suggested_description", f"{dominant_color} item photographed on campus grounds."),
        "aspect_ratio": aspect_ratio,
        "headline": ai_classification.get("headline", f"AI Detected: {dominant_color} {cat_name}"),
        "top_predictions": ai_classification.get("top_predictions", []),
        "model_engine": ai_classification.get("model_engine", "MobileNetV2-DeepNeuralNet"),
        "visual_features": features
    }

@router.post("/{report_id}/images", response_model=ItemImageResponse)
async def upload_report_image(
    report_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Securely uploads an item photograph, validates MIME & dimensions,
    extracts computer vision feature vector (512-dim), updates item metadata,
    and automatically triggers AI matching against opposite reports.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Report belongs to another institution")

    is_staff = current_user.role in (UserRole.TEACHER, UserRole.COLLEGE_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.ADMIN)
    is_owner = report.created_by_user_id == current_user.id
    if not is_staff and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to upload images for this report")

    # Save and validate image
    storage_key, mime_type, file_size, width, height = await storage_service.save_image(file)
    file_path = storage_service.get_file_path(storage_key)

    # Extract visual features (embeddings + dominant colors)
    visual_features = None
    try:
        visual_features = vision_extractor.extract_features(file_path)
    except Exception as e:
        # Fallback gracefully
        visual_features = {
            "embedding": [0.0] * 512,
            "primary_color": "Unknown",
            "model_version": "CampusTrace-Vision-Fallback",
            "error": str(e)
        }

    is_first_image = len(report.images) == 0

    item_image = ItemImage(
        report_id=report.id,
        item_id=report.item.id if report.item else None,
        storage_key=storage_key,
        original_filename=file.filename or "upload.jpg",
        mime_type=mime_type,
        file_size=file_size,
        image_width=width,
        image_height=height,
        visual_features=visual_features,
        uploaded_by_user_id=current_user.id,
        is_primary=is_first_image
    )
    db.add(item_image)
    db.flush()

    # If first image or item color not set, update item primary color if detected
    if report.item:
        if is_first_image:
            report.item.primary_image_id = item_image.id
        if not report.item.color and visual_features and visual_features.get("primary_color"):
            detected_c = visual_features["primary_color"]
            if detected_c != "Unknown":
                report.item.color = detected_c

    db.commit()
    db.refresh(item_image)

    log_audit_event(
        db=db,
        action="IMAGE_UPLOADED",
        entity_type="IMAGE",
        entity_id=str(item_image.id),
        actor_user_id=current_user.id,
        metadata={
            "report_id": report.id,
            "storage_key": storage_key,
            "detected_color": visual_features.get("primary_color") if visual_features else None
        }
    )

    # Re-trigger AI matching with new visual embedding
    try:
        matching_engine.find_and_save_matches_for_report(db, report)
    except Exception as e:
        logger.error(f"Failed to auto-match report #{report.id}: {e}", exc_info=True)

    return item_image

@router.post("/{report_id}/close")
def close_report(
    report_id: int,
    payload: Optional[ReportCloseRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Close and permanently remove an active report from the system.
    Authorized for report owner, finder/submitter, and campus teachers/admins.
    Entirely deletes the report and associated files so it cannot be reopened.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Multi-tenant isolation
    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Report belongs to another institution")

    # Permission check: Student owner/creator or Teacher/Admin
    is_owner = current_user.id in (
        report.created_by_user_id,
        report.submitted_by_student_id,
        report.reported_lost_by_student_id,
        report.reported_found_by_student_id
    )
    is_staff = current_user.role in (UserRole.TEACHER, UserRole.ADMIN, UserRole.PLATFORM_ADMIN)

    if not is_owner and not is_staff:
        raise HTTPException(status_code=403, detail="You do not have permission to close this report")

    if report.status == ReportStatus.RETURNED:
        raise HTTPException(status_code=400, detail="Cannot close a report that has already been returned to its owner")

    report_number = report.report_number
    reason = payload.reason if payload and payload.reason else "Report closed and permanently removed"
    notes = payload.notes.strip() if payload and payload.notes else None

    # Log audit event before deletion
    log_audit_event(
        db=db,
        action="REPORT_CLOSED_AND_REMOVED",
        entity_type="REPORT",
        entity_id=str(report.id),
        actor_user_id=current_user.id,
        metadata={
            "report_number": report_number,
            "reason": reason,
            "notes": notes,
            "closed_by_role": current_user.role.value
        }
    )

    # 1. Unlink any claims referencing this report as linked_lost_report_id
    from app.models.claim import Claim
    db.query(Claim).filter(Claim.linked_lost_report_id == report.id).update(
        {"linked_lost_report_id": None}, synchronize_session=False
    )

    # 2. Clean up physical image files from disk if present
    from app.config import settings
    for img in report.images:
        if img.storage_key:
            file_path = settings.UPLOAD_DIR / img.storage_key
            if file_path.exists():
                try:
                    file_path.unlink()
                except Exception as e:
                    logger.warning(f"Failed to delete image file {img.storage_key}: {e}")

    # 3. Clean up matches where this report was lost or found
    from app.models.match import Match
    db.query(Match).filter(
        or_(Match.lost_report_id == report.id, Match.found_report_id == report.id)
    ).delete(synchronize_session=False)

    # 4. Clean up custody records and return records
    from app.models.custody import CustodyRecord
    from app.models.return_record import ReturnRecord
    db.query(ReturnRecord).filter(ReturnRecord.report_id == report.id).delete(synchronize_session=False)
    db.query(CustodyRecord).filter(CustodyRecord.report_id == report.id).delete(synchronize_session=False)

    # 5. Clean up claims for found report
    db.query(Claim).filter(Claim.found_report_id == report.id).delete(synchronize_session=False)

    # 6. Delete item images and item
    db.query(ItemImage).filter(ItemImage.report_id == report.id).delete(synchronize_session=False)
    db.query(Item).filter(Item.report_id == report.id).delete(synchronize_session=False)

    # 7. Delete report itself
    db.delete(report)
    db.commit()

    return {
        "message": f"Report #{report_number} has been closed and permanently removed.",
        "id": report_id,
        "report_number": report_number,
        "status": "REMOVED"
    }

@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently delete and remove a report."""
    return close_report(report_id=report_id, payload=None, current_user=current_user, db=db)

@router.post("/{report_id}/reopen")
def reopen_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reopening reports is discontinued because closing entirely removes the report."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found (closed reports are permanently removed)")
    raise HTTPException(status_code=400, detail="Reports cannot be reopened. Closing a report entirely removes it from the system.")

@router.get("/{report_id}/matches", response_model=List[MatchResponse])
def get_report_matches(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all potential AI matches for this report."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Report belongs to another institution")

    # If this report is CLOSED or RETURNED, it has no active suggested matches
    if report.status in (ReportStatus.CLOSED, ReportStatus.RETURNED):
        return []

    if report.report_type == ReportType.LOST:
        matches = [m for m in report.lost_matches if m.found_report and m.found_report.status not in (ReportStatus.CLOSED, ReportStatus.RETURNED)]
    else:
        matches = [m for m in report.found_matches if m.lost_report and m.lost_report.status not in (ReportStatus.CLOSED, ReportStatus.RETURNED)]

    # Format summaries for nested views
    results = []
    for m in matches:
        resp = MatchResponse.model_validate(m)
        if m.lost_report:
            resp.lost_report_summary = {
                "id": m.lost_report.id,
                "report_number": m.lost_report.report_number,
                "item_name": m.lost_report.item.item_name if m.lost_report.item else "Unknown",
                "category": m.lost_report.item.category.name if m.lost_report.item and m.lost_report.item.category else "Unknown",
                "color": m.lost_report.item.color if m.lost_report.item else None,
                "report_date": str(m.lost_report.report_date),
                "location": m.lost_report.location.name if m.lost_report.location else None,
                "primary_image_key": m.lost_report.images[0].storage_key if m.lost_report.images else None
            }
        if m.found_report:
            resp.found_report_summary = {
                "id": m.found_report.id,
                "report_number": m.found_report.report_number,
                "item_name": m.found_report.item.item_name if m.found_report.item else "Unknown",
                "category": m.found_report.item.category.name if m.found_report.item and m.found_report.item.category else "Unknown",
                "color": m.found_report.item.color if m.found_report.item else None,
                "report_date": str(m.found_report.report_date),
                "location": m.found_report.location.name if m.found_report.location else None,
                "primary_image_key": m.found_report.images[0].storage_key if m.found_report.images else None,
                "status": m.found_report.status.value
            }
        results.append(resp)

    return sorted(results, key=lambda x: x.similarity_score, reverse=True)
