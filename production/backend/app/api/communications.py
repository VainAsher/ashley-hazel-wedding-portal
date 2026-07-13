import html
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import (
    ROLE_COORDINATOR,
    ROLE_COUPLE,
    ROLE_GUEST,
    require_coordinator,
)
from app.api.schemas_auth import UserResponse
from app.config import get_settings
from app.db.database import get_db
from app.db.models import Communication, Guest, Invite, Notification, RsvpStatus, Wedding
from app.db.schemas import (
    CommunicationCreate,
    CommunicationResponse,
    CommunicationUpdate,
)
from app.logging import get_logger


router = APIRouter(prefix="/api/communications", tags=["communications"])
logger = get_logger(__name__)

# notifications.title is VARCHAR(200); communication subjects go up to 255.
NOTIFICATION_TITLE_MAX = 200

# Resend's batch send endpoint; accepts up to 100 individual emails per call.
RESEND_BATCH_URL = "https://api.resend.com/emails/batch"
RESEND_BATCH_CHUNK_SIZE = 100
RESEND_TIMEOUT_SECONDS = 10.0

# The original RSVP-based audiences target guest invites by RSVP status.
AUDIENCE_RSVP_STATUS = {
    "attending": RsvpStatus.accepted,
    "pending": RsvpStatus.pending,
    "declined": RsvpStatus.declined,
}

# Party audiences ship ahead of the Wave 3 party flags: valid to select,
# but they match no invites until members carry party membership.
PARTY_AUDIENCES = {"wedding_party", "stags", "hens"}


def audience_invites(db: Session, wedding_id: int, audience: str) -> list[Invite]:
    """Resolve a communication audience to the invites it addresses."""
    if audience in PARTY_AUDIENCES:
        return []

    query = db.query(Invite).filter(Invite.wedding_id == wedding_id)
    if audience == "guests":
        query = query.filter(Invite.role == ROLE_GUEST)
    elif audience == "coordinators":
        # The couple run the admin alongside coordinators everywhere else
        # (require_coordinator), so they are part of this audience too.
        query = query.filter(Invite.role.in_((ROLE_COUPLE, ROLE_COORDINATOR)))
    elif audience in AUDIENCE_RSVP_STATUS:
        query = query.join(Guest, Invite.guest_id == Guest.id).filter(
            Guest.rsvp_status == AUDIENCE_RSVP_STATUS[audience]
        )
    # "all": every invite in the wedding, no extra filter.
    return query.all()


def email_recipients_for(invites: list[Invite]) -> list[tuple[str, str]]:
    """Resolve invites to (email, display_name) pairs eligible for email.

    Invites with no linked guest, or whose guest has no email on file,
    cannot receive email today (same limitation as RSVP reminders) — they
    are simply excluded here; they already received the in-app notification.
    """
    return [
        (invite.guest.email, invite.guest.name)
        for invite in invites
        if invite.guest is not None and invite.guest.email is not None
    ]


def communication_email_html(subject: str, body: str | None) -> str:
    """Build a minimal HTML email body from a communication's subject/body."""
    safe_body = html.escape(body or "").replace("\n", "<br>")
    return f"<h1>{html.escape(subject)}</h1><p>{safe_body}</p>"


def send_email_batch(
    recipients: list[tuple[str, str]], subject: str, html_body: str
) -> int:
    """POST one email per recipient to Resend's batch endpoint.

    `recipients` is a list of (email, display_name) pairs. Resend's batch
    endpoint accepts up to 100 emails per call; this chunks accordingly so
    the code doesn't silently break if the guest list grows, even though
    this wedding's guest list fits in a single call today. Returns the
    number of recipients in chunks Resend accepted (2xx response). Never
    raises on a non-2xx response or a network failure — the caller treats
    this as best-effort and callers should still guard the call themselves.
    """
    settings = get_settings()
    accepted = 0
    for start in range(0, len(recipients), RESEND_BATCH_CHUNK_SIZE):
        chunk = recipients[start : start + RESEND_BATCH_CHUNK_SIZE]
        payload = [
            {
                "from": settings.email_from_address,
                "to": [f"{name} <{email}>" if name else email],
                "subject": subject,
                "html": html_body,
            }
            for email, name in chunk
        ]
        try:
            response = httpx.post(
                RESEND_BATCH_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                timeout=RESEND_TIMEOUT_SECONDS,
            )
            if 200 <= response.status_code < 300:
                accepted += len(chunk)
            else:
                logger.warning(
                    "resend_batch_send_failed",
                    extra={
                        "status_code": response.status_code,
                        "chunk_size": len(chunk),
                    },
                )
        except Exception:  # noqa: BLE001 - best-effort: never block in-app delivery
            logger.warning(
                "resend_batch_send_error", extra={"chunk_size": len(chunk)}
            )
    return accepted


def get_communication_or_404(
    db: Session, communication_id: int, wedding_id: int, action: str
) -> Communication:
    communication = db.get(Communication, communication_id)
    if communication is None or communication.wedding_id != wedding_id:
        logger.warning(
            "communication_not_found",
            extra={"action": action, "communication_id": communication_id},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Communication not found"
        )
    return communication


@router.get("", response_model=list[CommunicationResponse])
async def list_communications(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[Communication]:
    return (
        db.query(Communication)
        .filter(Communication.wedding_id == current_user.wedding_id)
        .order_by(Communication.created_at.desc(), Communication.id.desc())
        .all()
    )


@router.post("", response_model=CommunicationResponse, status_code=status.HTTP_201_CREATED)
async def create_communication(
    communication: CommunicationCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Communication:
    if communication.wedding_id is None:
        communication.wedding_id = current_user.wedding_id
    elif communication.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create communications for other weddings",
        )
    if db.get(Wedding, communication.wedding_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wedding not found",
        )

    db_communication = Communication(**communication.model_dump())
    db.add(db_communication)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "communication_create_rejected",
            extra={"wedding_id": communication.wedding_id},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Communication could not be created",
        ) from exc

    db.refresh(db_communication)
    logger.info("communication_created", extra={"communication_id": db_communication.id})
    return db_communication


@router.put("/{communication_id}", response_model=CommunicationResponse)
async def update_communication(
    communication_id: int,
    communication: CommunicationUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Communication:
    db_communication = get_communication_or_404(
        db, communication_id, current_user.wedding_id, "update_communication"
    )
    update_data = communication.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_communication, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "communication_update_rejected",
            extra={"communication_id": communication_id},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Communication could not be updated",
        ) from exc

    db.refresh(db_communication)
    logger.info("communication_updated", extra={"communication_id": communication_id})
    return db_communication


@router.delete("/{communication_id}")
async def delete_communication(
    communication_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, int | str]:
    db_communication = get_communication_or_404(
        db, communication_id, current_user.wedding_id, "delete_communication"
    )
    db.delete(db_communication)
    db.commit()
    logger.info("communication_deleted", extra={"communication_id": communication_id})
    return {"status": "deleted", "id": communication_id}


@router.post("/{communication_id}/send", response_model=CommunicationResponse)
async def send_communication(
    communication_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Communication:
    db_communication = get_communication_or_404(
        db, communication_id, current_user.wedding_id, "send_communication"
    )
    # Sending always delivers in-app by fanning out one notification per
    # audience invite, surfaced on member dashboards and the header bell,
    # regardless of channel. When channel="email" this is additionally
    # backed by real email delivery below (WhatsApp/SMS remain not built).
    recipients = audience_invites(
        db, db_communication.wedding_id, db_communication.audience
    )
    for invite in recipients:
        db.add(
            Notification(
                wedding_id=db_communication.wedding_id,
                recipient_invite_id=invite.id,
                kind="communication",
                title=db_communication.subject[:NOTIFICATION_TITLE_MAX],
                body=db_communication.body,
                link_path="/dashboard",
            )
        )
    db_communication.status = "sent"
    db_communication.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_communication)
    logger.info(
        "communication_sent",
        extra={
            "communication_id": communication_id,
            "audience": db_communication.audience,
            "notified": len(recipients),
        },
    )

    # Best-effort email delivery: a missing API key or a Resend outage must
    # never fail this request or roll back the in-app notifications already
    # committed above (mirrors the gallery thumbnail best-effort pattern).
    if db_communication.channel == "email":
        settings = get_settings()
        if not settings.resend_api_key:
            logger.warning(
                "communication_email_skipped_no_api_key",
                extra={"communication_id": communication_id},
            )
        else:
            email_recipients = email_recipients_for(recipients)
            try:
                accepted = send_email_batch(
                    email_recipients,
                    db_communication.subject,
                    communication_email_html(
                        db_communication.subject, db_communication.body
                    ),
                )
                logger.info(
                    "communication_email_sent",
                    extra={
                        "communication_id": communication_id,
                        "attempted": len(email_recipients),
                        "accepted": accepted,
                    },
                )
            except Exception:  # noqa: BLE001 - never block the in-app send that already succeeded
                logger.warning(
                    "communication_email_failed",
                    extra={
                        "communication_id": communication_id,
                        "attempted": len(email_recipients),
                    },
                )

    return db_communication
