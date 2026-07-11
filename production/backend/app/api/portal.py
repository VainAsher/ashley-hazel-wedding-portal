from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import (
    Blessing,
    Event,
    GalleryItem,
    Guest,
    RsvpStatus,
    SongRequest,
    Wedding,
)
from app.db.schemas import ScheduleEventResponse, WeddingInfoResponse, WeddingTheme
from app.logging import get_logger


router = APIRouter(prefix="/api/portal", tags=["portal"])
logger = get_logger(__name__)


class ThemeResponse(BaseModel):
    theme: WeddingTheme | None = None


@router.get("/theme", response_model=ThemeResponse)
async def get_theme(db: Session = Depends(get_db)) -> ThemeResponse:
    """Public guest-site theme.

    Deliberately unauthenticated: the invite page needs the couple's colours
    before login, and the payload is only cosmetic (colours + tint opacity).
    Single-wedding deployment, so the first wedding row is the wedding.
    """
    wedding = db.query(Wedding).order_by(Wedding.id).first()
    theme = WeddingTheme.model_validate(wedding.theme) if wedding and wedding.theme else None
    return ThemeResponse(theme=theme)


@router.get("/wedding", response_model=WeddingInfoResponse)
async def get_wedding_info(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> Wedding:
    wedding = db.get(Wedding, current_user.wedding_id)
    if wedding is None:
        logger.warning(
            "portal_wedding_not_found",
            extra={"wedding_id": current_user.wedding_id},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Wedding not found"
        )
    return wedding


class ProgressResponse(BaseModel):
    rsvp_submitted: bool
    song_requested: bool
    photo_submitted: bool
    blessing_posted: bool


@router.get("/me/progress", response_model=ProgressResponse)
async def get_my_progress(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> ProgressResponse:
    """What the current member has and hasn't done yet (onboarding checklist).

    Cheap existence queries, no schema changes. RSVP is id-linked via the
    session's guest_id; songs, photos and blessings only store the submitter's
    display name, so those match on current_user.name — fine for a friendly
    nudge card, never to be used for access control.
    """
    rsvp_submitted = False
    if current_user.guest_id is not None:
        guest = db.get(Guest, current_user.guest_id)
        rsvp_submitted = (
            guest is not None and guest.rsvp_status != RsvpStatus.pending
        )

    song_requested = (
        db.query(SongRequest.id)
        .filter(
            SongRequest.wedding_id == current_user.wedding_id,
            SongRequest.requested_by == current_user.name,
        )
        .first()
        is not None
    )
    photo_submitted = (
        db.query(GalleryItem.id)
        .filter(
            GalleryItem.wedding_id == current_user.wedding_id,
            GalleryItem.uploaded_by == current_user.name,
        )
        .first()
        is not None
    )
    blessing_posted = (
        db.query(Blessing.id)
        .filter(
            Blessing.wedding_id == current_user.wedding_id,
            Blessing.author_name == current_user.name,
        )
        .first()
        is not None
    )

    return ProgressResponse(
        rsvp_submitted=rsvp_submitted,
        song_requested=song_requested,
        photo_submitted=photo_submitted,
        blessing_posted=blessing_posted,
    )


@router.get("/schedule", response_model=list[ScheduleEventResponse])
async def get_schedule(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> list[Event]:
    return (
        db.query(Event)
        .filter(Event.wedding_id == current_user.wedding_id)
        .order_by(Event.event_date, Event.event_time, Event.id)
        .all()
    )
