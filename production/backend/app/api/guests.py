from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import ROLE_GUEST, require_coordinator, require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Guest, MenuOption, Wedding
from app.db.schemas import GuestCreate, GuestResponse, GuestRSVPUpdate, GuestUpdate
from app.logging import get_logger


router = APIRouter(prefix="/api/guests", tags=["guests"])
logger = get_logger(__name__)


# Contact fields stay editable by the guest regardless of wedding phase (see
# update_guest_rsvp below) -- unlike RSVP status/meal/dietary fields, there's
# no reason to freeze a guest's own address/phone/email while RSVP is closed.
GUEST_CONTACT_FIELDS = {"email", "phone", "address"}


CONSTRAINT_MESSAGES = {
    "uq_guests_wedding_email": "Guest email already exists for this wedding",
    "guests_wedding_id_email_key": "Guest email already exists for this wedding",
    "ck_guests_email_format": "Guest email must be a valid address",
    "ck_guests_name_not_blank": "Guest name is required",
    "ck_guests_table_number_positive": "Table number must be positive",
    "ck_guests_seat_number_positive": "Seat number must be positive",
}


def guest_constraint_message(exc: IntegrityError, action: str) -> str:
    diag = getattr(getattr(exc, "orig", None), "diag", None)
    constraint_name = getattr(diag, "constraint_name", None)
    return CONSTRAINT_MESSAGES.get(constraint_name, f"Guest could not be {action}")


def get_guest_or_404(db: Session, guest_id: int, action: str) -> Guest:
    guest = db.get(Guest, guest_id)
    if guest is None:
        logger.warning("guest_not_found", extra={"action": action, "guest_id": guest_id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
    return guest


def ensure_wedding_exists(db: Session, wedding_id: int, action: str) -> None:
    if db.get(Wedding, wedding_id) is None:
        logger.warning("wedding_not_found", extra={"action": action, "wedding_id": wedding_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wedding not found",
        )


def ensure_guest_rsvp_access(current_user: UserResponse, guest_id: int) -> None:
    if current_user.role == ROLE_GUEST and current_user.guest_id != guest_id:
        logger.warning(
            "guest_rsvp_access_denied",
            extra={
                "guest_id": guest_id,
                "session_guest_id": current_user.guest_id,
                "role": current_user.role,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access another guest RSVP",
        )


@router.post("", response_model=GuestResponse, status_code=status.HTTP_201_CREATED)
async def create_guest(
    guest: GuestCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Guest:
    logger.info("guest_create_started", extra={"wedding_id": guest.wedding_id})
    ensure_wedding_exists(db, guest.wedding_id, "create_guest")
    if guest.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create guests for other weddings"
        )

    db_guest = Guest(**guest.model_dump())
    db.add(db_guest)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "guest_create_rejected",
            extra={
                "constraint": getattr(getattr(exc.orig, "diag", None), "constraint_name", None),
                "wedding_id": guest.wedding_id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=guest_constraint_message(exc, "created"),
        ) from exc

    db.refresh(db_guest)
    logger.info(
        "guest_created",
        extra={"guest_id": db_guest.id, "wedding_id": db_guest.wedding_id},
    )
    return db_guest


@router.get("", response_model=list[GuestResponse])
async def list_guests(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[Guest]:
    logger.debug("guest_list_started", extra={"skip": skip, "limit": limit, "wedding_id": current_user.wedding_id})
    guests = db.query(Guest).filter(Guest.wedding_id == current_user.wedding_id).order_by(Guest.id).offset(skip).limit(limit).all()
    logger.debug("guest_list_completed", extra={"count": len(guests)})
    return guests


@router.get("/{guest_id}", response_model=GuestResponse)
async def get_guest(
    guest_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> Guest:
    logger.debug("guest_read_started", extra={"guest_id": guest_id})
    guest = get_guest_or_404(db, guest_id, "get_guest")
    ensure_guest_rsvp_access(current_user, guest_id)
    logger.debug("guest_read_completed", extra={"guest_id": guest_id})
    return guest


@router.patch("/{guest_id}", response_model=GuestResponse)
async def update_guest_rsvp(
    guest_id: int,
    rsvp: GuestRSVPUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> Guest:
    logger.info("guest_rsvp_update_started", extra={"guest_id": guest_id})
    db_guest = get_guest_or_404(db, guest_id, "update_guest_rsvp")
    ensure_guest_rsvp_access(current_user, guest_id)
    update_data = rsvp.model_dump(exclude_unset=True)

    # Contact fields (email/phone/address) are exempt from the phase gate --
    # only RSVP status/meal/dietary fields require the wedding to be live.
    if update_data.keys() - GUEST_CONTACT_FIELDS and current_user.wedding_phase != "live":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RSVP is not currently open.",
        )

    # Meal picks are gated like RSVP itself is gated by phase: while the
    # couple's meal_selection_open switch is off, sending a meal field is
    # rejected outright (403) rather than silently dropped, so a stale client
    # can't believe a choice was saved. While open, a non-null choice must
    # name one of this wedding's *active* menu options (422 otherwise).
    meal_fields = {"meal_choice", "plus_one_meal_choice"} & update_data.keys()
    if meal_fields:
        wedding = db.get(Wedding, db_guest.wedding_id)
        if wedding is None or not wedding.meal_selection_open:
            logger.warning(
                "guest_rsvp_meal_rejected_closed",
                extra={"guest_id": guest_id, "meal_fields": sorted(meal_fields)},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Meal selection is not currently open.",
            )
        active_names = {
            name
            for (name,) in db.query(MenuOption.name).filter(
                MenuOption.wedding_id == db_guest.wedding_id,
                MenuOption.active.is_(True),
            )
        }
        for field in sorted(meal_fields):
            value = update_data[field]
            if value is not None and value not in active_names:
                logger.warning(
                    "guest_rsvp_meal_unknown_option",
                    extra={"guest_id": guest_id, "meal_field": field},
                )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Unknown menu option for {field}.",
                )

    for field, value in update_data.items():
        setattr(db_guest, field, value)

    if update_data:
        db_guest.updated_at = datetime.now()

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "guest_rsvp_update_rejected",
            extra={
                "constraint": getattr(getattr(exc.orig, "diag", None), "constraint_name", None),
                "guest_id": guest_id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=guest_constraint_message(exc, "updated"),
        ) from exc

    db.refresh(db_guest)
    logger.info(
        "guest_rsvp_updated",
        extra={
            "guest_id": db_guest.id,
            "updated_fields": sorted(update_data.keys()),
            "wedding_id": db_guest.wedding_id,
        },
    )
    return db_guest


@router.put("/{guest_id}", response_model=GuestResponse)
async def update_guest(
    guest_id: int,
    guest: GuestUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Guest:
    logger.info("guest_update_started", extra={"guest_id": guest_id})
    db_guest = get_guest_or_404(db, guest_id, "update_guest")
    if db_guest.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update guests from other weddings"
        )
    update_data = guest.model_dump(exclude_unset=True)

    if "wedding_id" in update_data:
        ensure_wedding_exists(db, update_data["wedding_id"], "update_guest")

    for field, value in update_data.items():
        setattr(db_guest, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "guest_update_rejected",
            extra={
                "constraint": getattr(getattr(exc.orig, "diag", None), "constraint_name", None),
                "guest_id": guest_id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=guest_constraint_message(exc, "updated"),
        ) from exc

    db.refresh(db_guest)
    logger.info(
        "guest_updated",
        extra={
            "guest_id": db_guest.id,
            "updated_fields": sorted(update_data.keys()),
            "wedding_id": db_guest.wedding_id,
        },
    )
    return db_guest


@router.delete("/{guest_id}")
async def delete_guest(
    guest_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, int | str]:
    logger.info("guest_delete_started", extra={"guest_id": guest_id})
    db_guest = get_guest_or_404(db, guest_id, "delete_guest")
    if db_guest.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete guests from other weddings"
        )
    wedding_id = db_guest.wedding_id
    db.delete(db_guest)
    db.commit()
    logger.info("guest_deleted", extra={"guest_id": guest_id, "wedding_id": wedding_id})
    return {"status": "deleted", "id": guest_id}
