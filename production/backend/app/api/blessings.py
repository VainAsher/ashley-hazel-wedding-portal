from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator, require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Blessing
from app.db.schemas import (
    BlessingAdminResponse,
    BlessingCreate,
    BlessingModerate,
    BlessingResponse,
)
from app.logging import get_logger
from app.utils.mentions import fan_out_mentions, general_scope_directory


def get_blessing_or_404(db: Session, blessing_id: int, wedding_id: int) -> Blessing:
    blessing = db.get(Blessing, blessing_id)
    if blessing is None or blessing.wedding_id != wedding_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Blessing not found"
        )
    return blessing


router = APIRouter(prefix="/api/blessings", tags=["blessings"])
logger = get_logger(__name__)


@router.get("", response_model=list[BlessingResponse])
async def list_blessings(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> list[Blessing]:
    return (
        db.query(Blessing)
        .filter(
            Blessing.wedding_id == current_user.wedding_id,
            Blessing.hidden.is_(False),
        )
        .order_by(Blessing.created_at.desc(), Blessing.id.desc())
        .all()
    )


@router.post("", response_model=BlessingResponse, status_code=status.HTTP_201_CREATED)
async def create_blessing(
    blessing: BlessingCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> Blessing:
    author_name = blessing.author_name or current_user.name

    db_blessing = Blessing(
        wedding_id=current_user.wedding_id,
        author_name=author_name,
        message=blessing.message,
    )
    db.add(db_blessing)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "blessing_create_rejected",
            extra={"wedding_id": current_user.wedding_id},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Blessing could not be created",
        ) from exc

    db.refresh(db_blessing)
    logger.info("blessing_created", extra={"blessing_id": db_blessing.id})

    directory = general_scope_directory(db, current_user.wedding_id)
    fan_out_mentions(
        db,
        wedding_id=current_user.wedding_id,
        author_invite_id=current_user.invite_id,
        author_display_name=db_blessing.author_name,
        text=db_blessing.message,
        directory=directory,
        context_phrase="a blessing",
        link_path="/blessings",
    )
    db.commit()

    return db_blessing


@router.get("/all", response_model=list[BlessingAdminResponse])
async def list_all_blessings(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[Blessing]:
    """Admin moderation view — every blessing for the wedding, including hidden."""
    return (
        db.query(Blessing)
        .filter(Blessing.wedding_id == current_user.wedding_id)
        .order_by(Blessing.created_at.desc(), Blessing.id.desc())
        .all()
    )


@router.patch("/{blessing_id}", response_model=BlessingAdminResponse)
async def moderate_blessing(
    blessing_id: int,
    payload: BlessingModerate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Blessing:
    blessing = get_blessing_or_404(db, blessing_id, current_user.wedding_id)
    blessing.hidden = payload.hidden
    db.commit()
    db.refresh(blessing)
    logger.info(
        "blessing_moderated",
        extra={"blessing_id": blessing.id, "hidden": blessing.hidden},
    )
    return blessing


@router.delete("/{blessing_id}")
async def delete_blessing(
    blessing_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, object]:
    blessing = get_blessing_or_404(db, blessing_id, current_user.wedding_id)
    db.delete(blessing)
    db.commit()
    logger.info("blessing_deleted", extra={"blessing_id": blessing_id})
    return {"status": "deleted", "id": blessing_id}
