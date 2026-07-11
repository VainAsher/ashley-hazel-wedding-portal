from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Notification
from app.db.schemas import NotificationListResponse, NotificationResponse
from app.logging import get_logger


router = APIRouter(prefix="/api/notifications", tags=["notifications"])
logger = get_logger(__name__)

# The bell/Messages card only ever show recent items; cap the payload.
RECENT_LIMIT = 50


def own_notifications_query(db: Session, current_user: UserResponse):
    """Notifications addressed to this member (invite) in this wedding."""
    return db.query(Notification).filter(
        Notification.wedding_id == current_user.wedding_id,
        Notification.recipient_invite_id == current_user.invite_id,
    )


def get_own_notification_or_404(
    db: Session, notification_id: int, current_user: UserResponse
) -> Notification:
    notification = db.get(Notification, notification_id)
    if (
        notification is None
        or notification.wedding_id != current_user.wedding_id
        or notification.recipient_invite_id != current_user.invite_id
    ):
        # Cross-member and cross-wedding ids are indistinguishable from
        # missing ones on purpose.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )
    return notification


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> NotificationListResponse:
    """The current member's notifications, newest first, plus unread count.

    Deliberately not phase-gated: the couple may message members while the
    wedding is still in the planning phase.
    """
    base = own_notifications_query(db, current_user)
    items = (
        base.order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(RECENT_LIMIT)
        .all()
    )
    unread_count = base.filter(Notification.read_at.is_(None)).count()
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(item) for item in items],
        unread_count=unread_count,
    )


@router.post("/read-all")
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> dict[str, int]:
    updated = (
        own_notifications_query(db, current_user)
        .filter(Notification.read_at.is_(None))
        .update(
            {Notification.read_at: datetime.now(timezone.utc)},
            synchronize_session=False,
        )
    )
    db.commit()
    logger.info("notifications_read_all", extra={"updated": updated})
    return {"updated": updated}


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> Notification:
    notification = get_own_notification_or_404(db, notification_id, current_user)
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    logger.info("notification_read", extra={"notification_id": notification.id})
    return notification
