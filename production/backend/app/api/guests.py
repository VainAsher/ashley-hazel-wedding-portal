from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Guest, Wedding
from app.db.schemas import GuestCreate, GuestResponse, GuestUpdate


router = APIRouter(prefix="/api/guests", tags=["guests"])


def get_guest_or_404(db: Session, guest_id: int) -> Guest:
    guest = db.get(Guest, guest_id)
    if guest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
    return guest


def ensure_wedding_exists(db: Session, wedding_id: int) -> None:
    if db.get(Wedding, wedding_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wedding not found",
        )


@router.post("", response_model=GuestResponse, status_code=status.HTTP_201_CREATED)
async def create_guest(guest: GuestCreate, db: Session = Depends(get_db)) -> Guest:
    ensure_wedding_exists(db, guest.wedding_id)

    db_guest = Guest(**guest.model_dump())
    db.add(db_guest)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guest could not be created",
        ) from exc

    db.refresh(db_guest)
    return db_guest


@router.get("", response_model=list[GuestResponse])
async def list_guests(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[Guest]:
    return db.query(Guest).order_by(Guest.id).offset(skip).limit(limit).all()


@router.get("/{guest_id}", response_model=GuestResponse)
async def get_guest(guest_id: int, db: Session = Depends(get_db)) -> Guest:
    return get_guest_or_404(db, guest_id)


@router.put("/{guest_id}", response_model=GuestResponse)
async def update_guest(
    guest_id: int,
    guest: GuestUpdate,
    db: Session = Depends(get_db),
) -> Guest:
    db_guest = get_guest_or_404(db, guest_id)
    update_data = guest.model_dump(exclude_unset=True)

    if "wedding_id" in update_data:
        ensure_wedding_exists(db, update_data["wedding_id"])

    for field, value in update_data.items():
        setattr(db_guest, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guest could not be updated",
        ) from exc

    db.refresh(db_guest)
    return db_guest


@router.delete("/{guest_id}")
async def delete_guest(guest_id: int, db: Session = Depends(get_db)) -> dict[str, int | str]:
    db_guest = get_guest_or_404(db, guest_id)
    db.delete(db_guest)
    db.commit()
    return {"status": "deleted", "id": guest_id}
