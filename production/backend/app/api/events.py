from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Event, Wedding
from app.db.schemas import EventCreate, EventResponse, EventUpdate
from app.logging import get_logger


router = APIRouter(prefix="/api/events", tags=["events"])
logger = get_logger(__name__)


def get_event_or_404(db: Session, event_id: int, wedding_id: int, action: str) -> Event:
    event = db.get(Event, event_id)
    if event is None or event.wedding_id != wedding_id:
        logger.warning("event_not_found", extra={"action": action, "event_id": event_id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.get("", response_model=list[EventResponse])
async def list_events(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[Event]:
    return (
        db.query(Event)
        .filter(Event.wedding_id == current_user.wedding_id)
        .order_by(Event.event_date, Event.id)
        .all()
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Event:
    if event.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create events for other weddings",
        )
    if db.get(Wedding, event.wedding_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wedding not found",
        )

    db_event = Event(**event.model_dump())
    db.add(db_event)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("event_create_rejected", extra={"wedding_id": event.wedding_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event could not be created",
        ) from exc

    db.refresh(db_event)
    logger.info("event_created", extra={"event_id": db_event.id})
    return db_event


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event: EventUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Event:
    db_event = get_event_or_404(db, event_id, current_user.wedding_id, "update_event")
    update_data = event.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_event, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("event_update_rejected", extra={"event_id": event_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event could not be updated",
        ) from exc

    db.refresh(db_event)
    logger.info("event_updated", extra={"event_id": event_id})
    return db_event


@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, int | str]:
    db_event = get_event_or_404(db, event_id, current_user.wedding_id, "delete_event")
    db.delete(db_event)
    db.commit()
    logger.info("event_deleted", extra={"event_id": event_id})
    return {"status": "deleted", "id": event_id}
