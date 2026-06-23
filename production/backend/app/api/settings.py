from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Wedding
from app.db.schemas import WeddingSettingsResponse, WeddingSettingsUpdate
from app.logging import get_logger


router = APIRouter(prefix="/api/settings", tags=["settings"])
logger = get_logger(__name__)


def get_current_wedding_or_404(db: Session, wedding_id: int, action: str) -> Wedding:
    wedding = db.get(Wedding, wedding_id)
    if wedding is None:
        logger.warning("wedding_not_found", extra={"action": action, "wedding_id": wedding_id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wedding not found")
    return wedding


@router.get("/wedding", response_model=WeddingSettingsResponse)
async def get_wedding_settings(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Wedding:
    logger.debug("wedding_settings_read_started", extra={"wedding_id": current_user.wedding_id})
    return get_current_wedding_or_404(db, current_user.wedding_id, "get_wedding_settings")


@router.put("/wedding", response_model=WeddingSettingsResponse)
async def update_wedding_settings(
    settings: WeddingSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Wedding:
    logger.info("wedding_settings_update_started", extra={"wedding_id": current_user.wedding_id})
    wedding = get_current_wedding_or_404(db, current_user.wedding_id, "update_wedding_settings")
    update_data = settings.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(wedding, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "wedding_settings_update_rejected",
            extra={"wedding_id": current_user.wedding_id},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wedding could not be updated",
        ) from exc

    db.refresh(wedding)
    logger.info(
        "wedding_settings_updated",
        extra={
            "wedding_id": wedding.id,
            "updated_fields": sorted(update_data.keys()),
        },
    )
    return wedding
