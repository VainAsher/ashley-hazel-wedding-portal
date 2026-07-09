from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Event, Wedding
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
