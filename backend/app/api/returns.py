from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User, UserRole
from app.models.report import Report, ReportType, ReportStatus
from app.models.claim import Claim, ClaimStatus
from app.models.return_record import ReturnRecord, VerificationMethod
from app.schemas.return_record import ReturnRecordCreate, ReturnRecordResponse
from app.services.notification_service import create_notification
from app.services.audit_service import log_audit_event
from app.api.deps import get_current_user, require_teacher_or_above

router = APIRouter(tags=["Returns"])

@router.post("/reports/{report_id}/return", response_model=ReturnRecordResponse)
def execute_item_return(
    report_id: int,
    payload: ReturnRecordCreate,
    current_user: User = Depends(require_teacher_or_above),
    db: Session = Depends(get_db)
):
    """
    Teacher action: Verifies claimant identity in person, confirms physical handover of item,
    creates immutable ReturnRecord, transitions report to RETURNED, and closes linked claims.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Report belongs to another institution")

    if report.report_type != ReportType.FOUND:
        raise HTTPException(status_code=400, detail="Return operations apply only to FOUND items")

    if report.status == ReportStatus.RETURNED:
        raise HTTPException(status_code=400, detail="Item has already been marked as RETURNED")

    claim = db.query(Claim).filter(Claim.id == payload.claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Ownership claim not found")

    if claim.found_report_id != report.id:
        raise HTTPException(status_code=400, detail="Claim does not correspond to this found report")

    # If claim was not already approved, auto-approve it during in-person return
    if claim.status != ClaimStatus.APPROVED:
        claim.status = ClaimStatus.APPROVED
        claim.reviewed_by_teacher_id = current_user.id
        claim.reviewed_at = datetime.utcnow()
        claim.approved_at = datetime.utcnow()

    now = datetime.utcnow()
    report.status = ReportStatus.RETURNED
    report.resolved_at = now

    # Also resolve linked lost report if exists
    if claim.linked_lost_report_id:
        linked_lost = db.query(Report).filter(Report.id == claim.linked_lost_report_id).first()
        if linked_lost and linked_lost.status != ReportStatus.RETURNED:
            linked_lost.status = ReportStatus.RETURNED
            linked_lost.resolved_at = now

    # Create Return Record
    return_record = ReturnRecord(
        report_id=report.id,
        item_id=report.item.id if report.item else None,
        claim_id=claim.id,
        released_by_teacher_id=current_user.id,
        collected_by_student_id=claim.claimant_student_id,
        verification_method=payload.verification_method,
        returned_at=now,
        notes=payload.notes
    )
    db.add(return_record)

    # Reject any other pending claims on this item
    other_pending_claims = db.query(Claim).filter(
        Claim.found_report_id == report.id,
        Claim.id != claim.id,
        Claim.status.in_([ClaimStatus.PENDING, ClaimStatus.UNDER_REVIEW])
    ).all()
    for opc in other_pending_claims:
        opc.status = ClaimStatus.REJECTED
        opc.reviewed_by_teacher_id = current_user.id
        opc.reviewed_at = now
        opc.review_notes = "Item has been successfully claimed and returned to verified owner."

    db.commit()
    db.refresh(return_record)

    # Notify student
    create_notification(
        db=db,
        user_id=claim.claimant_student_id,
        title="Item Return Confirmed",
        message=f"Handover of item #{report.report_number} ({report.item.item_name if report.item else 'Item'}) has been completed with {current_user.full_name}. Thank you!",
        notification_type="ITEM_RETURNED",
        link_url=f"/reports/{report.id}"
    )

    log_audit_event(
        db=db,
        action="ITEM_RETURNED",
        entity_type="RETURN_RECORD",
        entity_id=str(return_record.id),
        actor_user_id=current_user.id,
        metadata={
            "report_number": report.report_number,
            "claimant_id": claim.claimant_student_id,
            "verification_method": payload.verification_method.value,
            "released_by": current_user.full_name
        }
    )

    return return_record

@router.get("/returns", response_model=List[ReturnRecordResponse])
def list_return_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List verified return records.
    Teachers and Admins view all institutional returns.
    Students view returns where they were the collector.
    """
    query = db.query(ReturnRecord)
    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if current_user.college_id:
            query = query.join(Report, ReturnRecord.report_id == Report.id).filter(Report.college_id == current_user.college_id)

    if current_user.role == UserRole.STUDENT:
        query = query.filter(ReturnRecord.collected_by_student_id == current_user.id)

    records = query.order_by(desc(ReturnRecord.returned_at)).all()
    return records
