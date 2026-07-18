import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
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

# ROADMAP item 18 (docs/specs/PAGE_BACKGROUNDS.md): a single background photo,
# not gallery's video-inclusive 150MB allowance.
MAX_BACKGROUND_UPLOAD_BYTES = 15 * 1024 * 1024


def get_uploads_dir() -> str:
    # Read lazily so tests can override UPLOADS_DIR at runtime.
    return os.environ.get("UPLOADS_DIR", "uploads")


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


class BackgroundUploadResponse(BaseModel):
    url: str


@router.post("/backgrounds/upload", response_model=BackgroundUploadResponse)
async def upload_page_background(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(require_coordinator),
) -> BackgroundUploadResponse:
    """Upload a photo for a guest/landing page background (ROADMAP item 18).

    No moderation, no thumbnail, no DB row at all -- unlike gallery/profile
    uploads, this drops the file and returns a URL; the couple's follow-up
    PUT /api/settings/wedding embeds that URL into theme.page_backgrounds.
    See docs/specs/PAGE_BACKGROUNDS.md.
    """
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image uploads are allowed",
        )

    data = await file.read()
    if len(data) > MAX_BACKGROUND_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 15MB upload limit",
        )

    ext = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{ext}"
    relative_path = f"{current_user.wedding_id}/backgrounds/{stored_name}"

    uploads_dir = Path(get_uploads_dir())
    background_dir = uploads_dir / str(current_user.wedding_id) / "backgrounds"
    background_dir.mkdir(parents=True, exist_ok=True)
    (uploads_dir / relative_path).write_bytes(data)

    logger.info(
        "page_background_uploaded",
        extra={"wedding_id": current_user.wedding_id},
    )
    return BackgroundUploadResponse(url=f"/uploads/{relative_path}")
