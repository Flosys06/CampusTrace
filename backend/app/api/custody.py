from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User, UserRole
from app.models.report import Report, ReportType, ReportStatus
from app.models.custody import CustodyRecord, HandoverStatus
from app.models.category_location import StorageLocation
from app.schemas.custody import HandoverConfirmRequest, CustodyTransferRequest, CustodyRecordResponse
from app.services.notification_service import create_notification
from app.services.audit_service import log_audit_event
from app.api.deps import get_current_user, require_teacher_or_above

router = APIRouter(tags=["Custody"])

@router.post("/reports/{report_id}/handover", response_model=CustodyRecordResponse)
def confirm_physical_handover(
    report_id: int,
    payload: HandoverConfirmRequest,
    current_user: User = Depends(require_teacher_or_above),
    db: Session = Depends(get_db)
):
    """
    Teacher action: Confirms physical intake/handover of a found item that was
    either submitted by a student or awaiting staff intake.
    Transitions status from PENDING_HANDOVER to IN_CUSTODY and records secure storage location.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Report belongs to another institution")

    if report.report_type != ReportType.FOUND:
        raise HTTPException(status_code=400, detail="Physical handover intake applies only to FOUND items")

    if report.status == ReportStatus.RETURNED:
        raise HTTPException(status_code=400, detail="Item has already been returned to owner")

    storage = db.query(StorageLocation).filter(StorageLocation.id == payload.storage_location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Designated storage location does not exist")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if storage.college_id and current_user.college_id and storage.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Storage location belongs to another institution")

    previous_custodian_id = report.reported_found_by_student_id or report.submitted_by_student_id
    if payload.finder_student_id:
        report.reported_found_by_student_id = payload.finder_student_id
        previous_custodian_id = payload.finder_student_id

    report.status = ReportStatus.IN_CUSTODY
    report.received_by_teacher_id = current_user.id

    custody_entry = CustodyRecord(
        report_id=report.id,
        item_id=report.item.id if report.item else None,
        previous_custodian_id=previous_custodian_id,
        new_custodian_id=current_user.id,
        transferred_by_user_id=current_user.id,
        received_by_user_id=current_user.id,
        storage_location_id=storage.id,
        handover_status=HandoverStatus.CONFIRMED,
        handover_notes=payload.handover_notes or f"Physical handover intake confirmed by {current_user.full_name}. Secured in {storage.name}.",
        transferred_at=datetime.utcnow(),
        acknowledged_at=datetime.utcnow()
    )
    db.add(custody_entry)
    db.commit()
    db.refresh(custody_entry)
    db.refresh(report)

    # Notify finder student if known
    if report.reported_found_by_student_id:
        create_notification(
            db=db,
            user_id=report.reported_found_by_student_id,
            title="Handover Confirmed by Teacher",
            message=f"Teacher {current_user.full_name} has confirmed physical intake of the found item #{report.report_number}. Thank you for your honesty!",
            notification_type="HANDOVER_CONFIRMED",
            link_url=f"/reports/{report.id}"
        )

    log_audit_event(
        db=db,
        action="HANDOVER_CONFIRMED",
        entity_type="REPORT",
        entity_id=str(report.id),
        actor_user_id=current_user.id,
        metadata={
            "report_number": report.report_number,
            "storage_location": storage.name,
            "custodian": current_user.full_name
        }
    )

    return custody_entry

@router.post("/reports/{report_id}/custody-transfers", response_model=CustodyRecordResponse)
def transfer_custody(
    report_id: int,
    payload: CustodyTransferRequest,
    current_user: User = Depends(require_teacher_or_above),
    db: Session = Depends(get_db)
):
    """
    Teacher/Admin action: Records physical transfer of item custody to another authorized staff member
    or updates storage vault location, preserving unbroken chain of custody.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Report belongs to another institution")

    new_custodian = db.query(User).filter(User.id == payload.new_custodian_id).first()
    if not new_custodian:
        raise HTTPException(status_code=404, detail="New custodian user not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if new_custodian.college_id and current_user.college_id and new_custodian.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Cannot transfer custody to staff from another institution")

    if new_custodian.role not in (UserRole.TEACHER, UserRole.COLLEGE_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        raise HTTPException(status_code=400, detail="New custodian must be an authorized teacher or administrator")

    storage_name = None
    if payload.storage_location_id:
        storage = db.query(StorageLocation).filter(StorageLocation.id == payload.storage_location_id).first()
        if not storage:
            raise HTTPException(status_code=404, detail="Storage location not found")
        if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
            if storage.college_id and current_user.college_id and storage.college_id != current_user.college_id:
                raise HTTPException(status_code=403, detail="Access denied: Storage location belongs to another institution")
        storage_name = storage.name

    previous_custodian_id = report.received_by_teacher_id
    report.received_by_teacher_id = new_custodian.id

    custody_entry = CustodyRecord(
        report_id=report.id,
        item_id=report.item.id if report.item else None,
        previous_custodian_id=previous_custodian_id,
        new_custodian_id=new_custodian.id,
        transferred_by_user_id=current_user.id,
        received_by_user_id=new_custodian.id,
        storage_location_id=payload.storage_location_id,
        handover_status=HandoverStatus.CONFIRMED,
        handover_notes=payload.handover_notes or f"Custody transferred from {current_user.full_name} to {new_custodian.full_name}.",
        transferred_at=datetime.utcnow(),
        acknowledged_at=datetime.utcnow()
    )
    db.add(custody_entry)
    db.commit()
    db.refresh(custody_entry)
    db.refresh(report)

    # Notify new custodian
    create_notification(
        db=db,
        user_id=new_custodian.id,
        title="Custody Assigned to You",
        message=f"{current_user.full_name} transferred custody of item #{report.report_number} to you.",
        notification_type="CUSTODY_TRANSFERRED",
        link_url=f"/reports/{report.id}"
    )

    log_audit_event(
        db=db,
        action="CUSTODY_TRANSFERRED",
        entity_type="REPORT",
        entity_id=str(report.id),
        actor_user_id=current_user.id,
        metadata={
            "report_number": report.report_number,
            "from_user": current_user.full_name,
            "to_user": new_custodian.full_name,
            "storage_location": storage_name
        }
    )

    return custody_entry

@router.get("/reports/{report_id}/custody-history", response_model=List[CustodyRecordResponse])
def get_custody_history(
    report_id: int,
    current_user: User = Depends(require_teacher_or_above),
    db: Session = Depends(get_db)
):
    """
    Teacher/Admin action: Retrieves the complete unbroken chain of custody records for an item.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Report belongs to another institution")

    records = db.query(CustodyRecord).filter(
        CustodyRecord.report_id == report_id
    ).order_by(desc(CustodyRecord.transferred_at)).all()

    return records
