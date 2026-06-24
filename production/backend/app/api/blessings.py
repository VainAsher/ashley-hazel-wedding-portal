from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Blessing
from app.db.schemas import BlessingCreate, BlessingResponse
from app.logging import get_logger


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
    return db_blessing
