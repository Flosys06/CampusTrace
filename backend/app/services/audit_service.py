import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

logger = logging.getLogger("campustrace.audit")

def log_audit_event(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    actor_user_id: Optional[int] = None,
    college_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
) -> Optional[AuditLog]:
    """
    Appends an immutable audit log entry for security and custody tracking.
    Never logs passwords or secret tokens.
    """
    try:
        # Sanitize metadata if any sensitive keys exist
        safe_meta = None
        if metadata:
            safe_meta = {
                k: v for k, v in metadata.items()
                if not any(secret in k.lower() for secret in ["password", "token", "secret", "evidence"])
            }
        
        audit_entry = AuditLog(
            college_id=college_id,
            actor_user_id=actor_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            change_metadata=safe_meta,
            ip_address=ip_address
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record audit event: {e}")
        return None
