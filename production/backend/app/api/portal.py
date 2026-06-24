from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Event, Wedding
from app.db.schemas import ScheduleEventResponse, WeddingInfoResponse
from app.logging import get_logger


router = APIRouter(prefix="/api/portal", tags=["portal"])
logger = get_logger(__name__)


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
