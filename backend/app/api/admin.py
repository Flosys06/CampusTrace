from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database import get_db
from app.models.user import User, UserRole
from app.models.report import Report, ReportType, ReportStatus
from app.models.item import Item, ItemImage
from app.models.claim import Claim, ClaimStatus
from app.models.match import Match, MatchStatus
from app.models.audit import AuditLog
from app.models.return_record import ReturnRecord
from app.schemas.admin import SystemStatsResponse, ModelHealthResponse, AuditLogResponse
from app.services.vision_extractor import vision_extractor
from app.api.deps import require_admin

router = APIRouter(prefix="/admin", tags=["Administration"])

@router.get("/analytics", response_model=SystemStatsResponse)
def get_system_analytics(
    college_id: Optional[int] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Administrator analytics overview:
    Calculates institutional recovery rates, active custody items, and resolution times.
    Enforces college isolation for College Administrators.
    """
    target_college_id = current_user.college_id if current_user.role == UserRole.COLLEGE_ADMIN else college_id

    report_q = db.query(Report)
    user_q = db.query(User)
    claim_q = db.query(Claim)
    match_q = db.query(Match)
    return_q = db.query(ReturnRecord)

    if target_college_id:
        report_q = report_q.filter(Report.college_id == target_college_id)
        user_q = user_q.filter(User.college_id == target_college_id)
        claim_q = claim_q.join(Report, Claim.found_report_id == Report.id).filter(Report.college_id == target_college_id)
        match_q = match_q.join(Report, Match.lost_report_id == Report.id).filter(Report.college_id == target_college_id)
        return_q = return_q.join(Report, ReturnRecord.report_id == Report.id).filter(Report.college_id == target_college_id)

    total_lost = report_q.filter(Report.report_type == ReportType.LOST).count()
    total_found = report_q.filter(Report.report_type == ReportType.FOUND).count()
    total_returned = return_q.count()
    active_in_custody = report_q.filter(Report.status == ReportStatus.IN_CUSTODY).count()
    pending_claims = claim_q.filter(Claim.status == ClaimStatus.PENDING).count()
    suggested_matches = match_q.filter(Match.match_status == MatchStatus.SUGGESTED).count()

    total_students = user_q.filter(User.role == UserRole.STUDENT).count()
    total_teachers = user_q.filter(User.role == UserRole.TEACHER).count()

    # Recovery rate % = (returned found items / total found items) * 100
    recovery_rate = round((float(total_returned) / max(1, total_found)) * 100.0, 1) if total_found > 0 else 0.0

    # Average resolution days for returned reports
    resolved_query = report_q.filter(
        Report.status == ReportStatus.RETURNED,
        Report.resolved_at != None,
        Report.created_at != None
    )
    resolved_reports = resolved_query.all()

    avg_days = 0.0
    if resolved_reports:
        total_days = sum((r.resolved_at - r.created_at).total_seconds() / 86400.0 for r in resolved_reports)
        avg_days = round(total_days / len(resolved_reports), 1)

    return SystemStatsResponse(
        total_lost_reports=total_lost,
        total_found_reports=total_found,
        total_returned_items=total_returned,
        active_in_custody=active_in_custody,
        pending_claims=pending_claims,
        suggested_matches=suggested_matches,
        total_students=total_students,
        total_teachers=total_teachers,
        recovery_rate_percent=recovery_rate,
        average_resolution_days=avg_days
    )

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    college_id: Optional[int] = Query(None),
    limit: int = Query(100, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Administrator security audit trail:
    Append-only chronological log of all sensitive operations, custody transitions, and logins.
    """
    target_college_id = current_user.college_id if current_user.role == UserRole.COLLEGE_ADMIN else college_id

    query = db.query(AuditLog)
    if target_college_id:
        query = query.filter(AuditLog.college_id == target_college_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    logs = query.order_by(desc(AuditLog.timestamp)).limit(limit).all()
    return logs

@router.get("/model-health", response_model=ModelHealthResponse)
def get_model_health(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Computer vision and matching pipeline diagnostic status.
    """
    health_info = vision_extractor.get_health()
    indexed_count = db.query(ItemImage).filter(ItemImage.visual_features != None).count()

    return ModelHealthResponse(
        engine_name=health_info["engine_name"],
        version=health_info["version"],
        status=health_info["status"],
        feature_dimensions=health_info["feature_dimensions"],
        indexed_images_count=indexed_count,
        last_inference_time_ms=health_info["last_inference_time_ms"]
    )
