from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.notification import Notification

def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notification_type: str = "SYSTEM",
    link_url: Optional[str] = None
) -> Notification:
    """Creates a persistent in-app notification for a user."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link_url=link_url,
        is_read=False
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

def notify_users(
    db: Session,
    user_ids: List[int],
    title: str,
    message: str,
    notification_type: str = "SYSTEM",
    link_url: Optional[str] = None
) -> List[Notification]:
    """Sends notification to multiple users simultaneously."""
    notifications = []
    for uid in set(user_ids):
        notif = Notification(
            user_id=uid,
            title=title,
            message=message,
            notification_type=notification_type,
            link_url=link_url,
            is_read=False
        )
        db.add(notif)
        notifications.append(notif)
    db.commit()
    return notifications
