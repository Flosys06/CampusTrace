from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User, UserRole
from app.models.report import Report, ReportType, ReportStatus
from app.models.claim import Claim, ClaimStatus
from app.schemas.claim import ClaimCreate, ClaimReviewRequest, ClaimResponse
from app.services.notification_service import create_notification
from app.services.audit_service import log_audit_event
from app.api.deps import get_current_user, require_teacher_or_above

router = APIRouter(tags=["Claims"])

@router.post("/found-reports/{report_id}/claims", response_model=ClaimResponse)
def submit_claim(
    report_id: int,
    payload: ClaimCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Student submits an ownership claim against a found item.
    Enforces that private ownership evidence is securely recorded.
    Updates report status to CLAIM_PENDING and alerts the custodian teacher.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Found report not found")
        
    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if report.college_id and current_user.college_id and report.college_id != current_user.college_id:
            raise HTTPException(status_code=403, detail="Access denied: Cannot claim items from another institution")

    if report.report_type != ReportType.FOUND:
        raise HTTPException(status_code=400, detail="Claims can only be filed against FOUND items")

    if report.status in (ReportStatus.RETURNED, ReportStatus.CLOSED):
        raise HTTPException(status_code=400, detail="This item has already been returned or closed")

    # Check if student already submitted a pending claim
    existing_claim = db.query(Claim).filter(
        Claim.found_report_id == report.id,
        Claim.claimant_student_id == current_user.id,
        Claim.status.in_([ClaimStatus.PENDING, ClaimStatus.UNDER_REVIEW, ClaimStatus.APPROVED])
    ).first()
    if existing_claim:
        raise HTTPException(status_code=400, detail="You already have an active claim on this item")

    claim = Claim(
        found_report_id=report.id,
        claimant_student_id=current_user.id,
        linked_lost_report_id=payload.linked_lost_report_id,
        claim_description=payload.claim_description.strip(),
        private_ownership_evidence=payload.private_ownership_evidence.strip(),
        status=ClaimStatus.PENDING
    )
    db.add(claim)

    # Transition report to CLAIM_PENDING if currently IN_CUSTODY or OPEN
    if report.status in (ReportStatus.IN_CUSTODY, ReportStatus.OPEN, ReportStatus.PENDING_HANDOVER):
        report.status = ReportStatus.CLAIM_PENDING

    db.commit()
    db.refresh(claim)

    # Notify receiving teacher or creator
    target_staff_id = report.received_by_teacher_id or report.created_by_user_id
    if target_staff_id:
        create_notification(
            db=db,
            user_id=target_staff_id,
            title="New Ownership Claim Received",
            message=f"Student {current_user.full_name} ({current_user.institutional_id}) has submitted a claim on found item #{report.report_number}.",
            notification_type="CLAIM_SUBMITTED",
            link_url=f"/claims"
        )

    log_audit_event(
        db=db,
        action="CLAIM_SUBMITTED",
        entity_type="CLAIM",
        entity_id=str(claim.id),
        actor_user_id=current_user.id,
        metadata={
            "found_report_number": report.report_number,
            "claimant_id": current_user.institutional_id
        }
    )

    return claim

@router.get("/claims", response_model=List[ClaimResponse])
def list_claims(
    report_id: Optional[int] = Query(None, description="Filter claims for a specific found report"),
    status_filter: Optional[ClaimStatus] = Query(None, alias="status"),
    my_claims_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List claims.
    Students see only their own claims with private evidence.
    Teachers see all claims requiring institutional review.
    """
    query = db.query(Claim)

    # Multi-tenant isolation: filter claims by institution
    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if current_user.college_id:
            query = query.join(Report, Claim.found_report_id == Report.id).filter(Report.college_id == current_user.college_id)

    if report_id:
        query = query.filter(Claim.found_report_id == report_id)

    if current_user.role == UserRole.STUDENT or my_claims_only:
        query = query.filter(Claim.claimant_student_id == current_user.id)

    if status_filter:
        query = query.filter(Claim.status == status_filter)

    claims = query.order_by(desc(Claim.created_at)).all()

    # Protect private evidence for non-authorized viewers
    results = []
    for c in claims:
        resp = ClaimResponse.model_validate(c)
        if c.found_report:
            resp.found_report_summary = {
                "id": c.found_report.id,
                "report_number": c.found_report.report_number,
                "item_name": c.found_report.item.item_name if c.found_report.item else "Unknown",
                "category": c.found_report.item.category.name if c.found_report.item and c.found_report.item.category else "Unknown",
                "status": c.found_report.status.value,
                "primary_image_key": c.found_report.images[0].storage_key if c.found_report.images else None
            }
        
        # Privacy guard
        if current_user.role == UserRole.STUDENT and c.claimant_student_id != current_user.id:
            resp.private_ownership_evidence = "[CONFIDENTIAL - PROTECTED EVIDENCE]"
            
        results.append(resp)

    return results

@router.get("/claims/{claim_id}", response_model=ClaimResponse)
def get_claim_detail(
    claim_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve details of a single claim."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if claim.found_report and claim.found_report.college_id and current_user.college_id:
            if claim.found_report.college_id != current_user.college_id:
                raise HTTPException(status_code=403, detail="Access denied: Claim belongs to another institution")

    is_staff = current_user.role in (UserRole.TEACHER, UserRole.COLLEGE_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.ADMIN)
    is_claimant = claim.claimant_student_id == current_user.id

    if not is_staff and not is_claimant:
        raise HTTPException(status_code=403, detail="Not authorized to inspect this claim")

    resp = ClaimResponse.model_validate(claim)
    if claim.found_report:
        resp.found_report_summary = {
            "id": claim.found_report.id,
            "report_number": claim.found_report.report_number,
            "item_name": claim.found_report.item.item_name if claim.found_report.item else "Unknown",
            "category": claim.found_report.item.category.name if claim.found_report.item and claim.found_report.item.category else "Unknown",
            "status": claim.found_report.status.value,
            "primary_image_key": claim.found_report.images[0].storage_key if claim.found_report.images else None
        }
    return resp

@router.post("/claims/{claim_id}/review", response_model=ClaimResponse)
def review_claim(
    claim_id: int,
    payload: ClaimReviewRequest,
    current_user: User = Depends(require_teacher_or_above),
    db: Session = Depends(get_db)
):
    """
    Teacher action: Approve or reject an ownership claim.
    Approval alone does NOT mark the item returned.
    Physical handover verification is required at collection time.
    """
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if claim.found_report and claim.found_report.college_id and current_user.college_id:
            if claim.found_report.college_id != current_user.college_id:
                raise HTTPException(status_code=403, detail="Access denied: Claim belongs to another institution")

    if payload.status not in (ClaimStatus.APPROVED, ClaimStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")

    now = datetime.now(timezone.utc)
    claim.status = payload.status
    claim.reviewed_by_teacher_id = current_user.id
    claim.review_notes = payload.review_notes
    claim.reviewed_at = now
    
    if payload.status == ClaimStatus.APPROVED:
        claim.approved_at = now
        # Notify student to collect physical item
        create_notification(
            db=db,
            user_id=claim.claimant_student_id,
            title="Claim Approved! Ready for Collection",
            message=f"Your claim on {claim.found_report.item.item_name if claim.found_report.item else 'item'} (#{claim.found_report.report_number}) has been approved! Please meet with the teacher to collect your item.",
            notification_type="CLAIM_APPROVED",
            link_url=f"/claims"
        )
    else:
        # If rejected, check if other claims remain
        remaining_pending = db.query(Claim).filter(
            Claim.found_report_id == claim.found_report_id,
            Claim.id != claim.id,
            Claim.status.in_([ClaimStatus.PENDING, ClaimStatus.UNDER_REVIEW])
        ).count()
        if remaining_pending == 0:
            claim.found_report.status = ReportStatus.IN_CUSTODY

        create_notification(
            db=db,
            user_id=claim.claimant_student_id,
            title="Claim Verification Update",
            message=f"Your claim on report #{claim.found_report.report_number} could not be approved. Note: {payload.review_notes or 'Proof of ownership was insufficient.'}",
            notification_type="CLAIM_REJECTED",
            link_url=f"/claims"
        )

    db.commit()
    db.refresh(claim)

    log_audit_event(
        db=db,
        action=f"CLAIM_{payload.status.value}",
        entity_type="CLAIM",
        entity_id=str(claim.id),
        actor_user_id=current_user.id,
        metadata={
            "found_report_id": claim.found_report_id,
            "claimant_id": claim.claimant_student_id,
            "notes": payload.review_notes
        }
    )

    return claim
