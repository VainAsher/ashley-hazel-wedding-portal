import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import GalleryItem
from app.db.schemas import GalleryItemResponse, GalleryItemUpdate
from app.logging import get_logger


router = APIRouter(prefix="/api/gallery", tags=["gallery"])
logger = get_logger(__name__)


def get_uploads_dir() -> str:
    # Read lazily so tests can override UPLOADS_DIR at runtime.
    return os.environ.get("UPLOADS_DIR", "uploads")


def get_gallery_item_or_404(
    db: Session, item_id: int, wedding_id: int, action: str
) -> GalleryItem:
    item = db.get(GalleryItem, item_id)
    if item is None or item.wedding_id != wedding_id:
        logger.warning(
            "gallery_item_not_found",
            extra={"action": action, "gallery_item_id": item_id},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Gallery item not found"
        )
    return item


@router.get("", response_model=list[GalleryItemResponse])
async def list_gallery_items(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[GalleryItem]:
    return (
        db.query(GalleryItem)
        .filter(GalleryItem.wedding_id == current_user.wedding_id)
        .order_by(GalleryItem.created_at.desc(), GalleryItem.id.desc())
        .all()
    )


@router.post("", response_model=GalleryItemResponse, status_code=status.HTTP_201_CREATED)
async def upload_gallery_item(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    caption: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> GalleryItem:
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image uploads are allowed",
        )

    wedding_id = current_user.wedding_id
    ext = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{ext}"
    relative_path = f"{wedding_id}/{stored_name}"

    uploads_dir = Path(get_uploads_dir())
    wedding_dir = uploads_dir / str(wedding_id)
    wedding_dir.mkdir(parents=True, exist_ok=True)

    data = await file.read()
    destination = wedding_dir / stored_name
    destination.write_bytes(data)

    db_item = GalleryItem(
        wedding_id=wedding_id,
        title=title,
        caption=caption,
        file_path=relative_path,
        content_type=content_type,
        file_size=len(data),
        uploaded_by=current_user.name,
        status="approved",
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    logger.info("gallery_item_uploaded", extra={"gallery_item_id": db_item.id})
    return db_item


@router.patch("/{item_id}", response_model=GalleryItemResponse)
async def update_gallery_item(
    item_id: int,
    item: GalleryItemUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> GalleryItem:
    db_item = get_gallery_item_or_404(
        db, item_id, current_user.wedding_id, "update_gallery_item"
    )
    update_data = item.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_item, field, value)

    db.commit()
    db.refresh(db_item)
    logger.info("gallery_item_updated", extra={"gallery_item_id": item_id})
    return db_item


@router.delete("/{item_id}")
async def delete_gallery_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, int | str]:
    db_item = get_gallery_item_or_404(
        db, item_id, current_user.wedding_id, "delete_gallery_item"
    )
    file_path = Path(get_uploads_dir()) / db_item.file_path

    db.delete(db_item)
    db.commit()

    # Best-effort file removal; a missing file should not fail the request.
    try:
        file_path.unlink(missing_ok=True)
    except OSError:
        logger.warning("gallery_item_file_unlink_failed", extra={"gallery_item_id": item_id})

    logger.info("gallery_item_deleted", extra={"gallery_item_id": item_id})
    return {"status": "deleted", "id": item_id}
