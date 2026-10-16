from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User, UserRole
from app.models.match import Match, MatchStatus
from app.models.report import Report, ReportStatus
from app.schemas.match import MatchResponse, MatchReviewRequest
from app.services.notification_service import create_notification
from app.services.audit_service import log_audit_event
from app.api.deps import get_current_user, require_teacher_or_above

router = APIRouter(prefix="/matches", tags=["Matches"])

@router.get("", response_model=List[MatchResponse])
def list_matches(
    status_filter: Optional[MatchStatus] = Query(None, alias="status"),
    min_score: Optional[float] = Query(None, ge=0.0, le=1.0),
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List potential matches.
    Teachers can view all suggestions; students can view matches related to their own reports.
    Excludes reports that are already closed or returned.
    """
    query = db.query(Match)
    
    # Exclude closed and returned reports from active match suggestions
    query = query.filter(
        Match.lost_report.has(~Report.status.in_([ReportStatus.CLOSED, ReportStatus.RETURNED])),
        Match.found_report.has(~Report.status.in_([ReportStatus.CLOSED, ReportStatus.RETURNED]))
    )

    # Multi-tenant isolation: filter matches by institution
    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if current_user.college_id:
            query = query.join(Report, Match.lost_report_id == Report.id).filter(Report.college_id == current_user.college_id)

    if current_user.role == UserRole.STUDENT:
        # Filter to matches involving student's reports
        query = query.filter(
            Match.lost_report.has(submitted_by_student_id=current_user.id) |
            Match.lost_report.has(created_by_user_id=current_user.id) |
            Match.lost_report.has(reported_lost_by_student_id=current_user.id)
        )

    if status_filter:
        query = query.filter(Match.match_status == status_filter)
    if min_score is not None:
        query = query.filter(Match.similarity_score >= min_score)

    matches = query.order_by(desc(Match.similarity_score)).limit(limit).all()

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

    return results

@router.post("/{match_id}/review", response_model=MatchResponse)
def review_match(
    match_id: int,
    payload: MatchReviewRequest,
    current_user: User = Depends(require_teacher_or_above),
    db: Session = Depends(get_db)
):
    """
    Teacher action: Review and confirm or reject a suggested match.
    Never automatically verifies ownership; confirmed matches invite formal claim submission.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match record not found")

    if current_user.role not in (UserRole.PLATFORM_ADMIN, UserRole.ADMIN):
        if match.lost_report and match.lost_report.college_id and current_user.college_id:
            if match.lost_report.college_id != current_user.college_id:
                raise HTTPException(status_code=403, detail="Access denied: Match belongs to another institution")

    if payload.match_status not in (MatchStatus.CONFIRMED, MatchStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Match status must be CONFIRMED or REJECTED")

    match.match_status = payload.match_status
    match.reviewed_by_user_id = current_user.id
    match.reviewed_at = datetime.utcnow()

    # If confirmed, notify the student who lost the item
    if payload.match_status == MatchStatus.CONFIRMED and match.lost_report:
        student_id = match.lost_report.submitted_by_student_id or match.lost_report.created_by_user_id
        if student_id:
            create_notification(
                db=db,
                user_id=student_id,
                title="Match Confirmed by Teacher!",
                message=f"A teacher has verified that found item #{match.found_report.report_number} closely matches your lost report #{match.lost_report.report_number}. You can now submit an ownership claim.",
                notification_type="MATCH_CONFIRMED",
                link_url=f"/reports/{match.found_report_id}"
            )

    db.commit()
    db.refresh(match)

    log_audit_event(
        db=db,
        action=f"MATCH_{payload.match_status.value}",
        entity_type="MATCH",
        entity_id=str(match.id),
        actor_user_id=current_user.id,
        metadata={"decision": payload.match_status.value, "notes": payload.notes}
    )

    return match
