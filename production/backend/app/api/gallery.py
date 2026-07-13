import os
import uuid
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from PIL import Image, ImageOps
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator, require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import GalleryItem
from app.db.schemas import GalleryItemResponse, GalleryItemUpdate
from app.logging import get_logger


router = APIRouter(prefix="/api/gallery", tags=["gallery"])
logger = get_logger(__name__)

# Grid thumbnails: ~480px-wide JPEG derivatives of JPEG/PNG originals.
THUMBNAIL_WIDTH = 480
THUMBNAIL_QUALITY = 80
THUMBNAIL_SOURCE_TYPES = {"image/jpeg", "image/png"}

# Video support is direct-upload-only: no transcoding, no thumbnail frame
# extraction (Pillow can't do video). MP4 is the only accepted video type;
# .mov, .webm, etc. are rejected with the same 400 as any unsupported image.
ALLOWED_VIDEO_TYPE = "video/mp4"

# App-level size cap. Nginx has its own (higher) ceiling in front of this so
# oversized requests get a clean 413 from here rather than a raw connection
# reset at the proxy.
MAX_UPLOAD_BYTES = 150 * 1024 * 1024


def get_uploads_dir() -> str:
    # Read lazily so tests can override UPLOADS_DIR at runtime.
    return os.environ.get("UPLOADS_DIR", "uploads")


def generate_thumbnail(
    uploads_dir: Path, relative_path: str, content_type: str | None
) -> str | None:
    """Write a grid-sized JPEG derivative under `<wedding_id>/thumbs/`.

    Returns the thumbnail's relative path, or None when the source format is
    unsupported or Pillow fails. Thumbnails are best-effort: callers fall back
    to the full-size original and must never fail because of one.
    """
    if content_type not in THUMBNAIL_SOURCE_TYPES:
        return None

    source = PurePosixPath(relative_path)
    thumb_relative = f"{source.parent}/thumbs/{source.stem}.jpg"
    try:
        with Image.open(uploads_dir / relative_path) as image:
            image = ImageOps.exif_transpose(image)
            if image.width > THUMBNAIL_WIDTH:
                height = max(
                    1, round(image.height * THUMBNAIL_WIDTH / image.width)
                )
                image = image.resize((THUMBNAIL_WIDTH, height))
            destination = uploads_dir / thumb_relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            image.convert("RGB").save(
                destination, "JPEG", quality=THUMBNAIL_QUALITY
            )
    except Exception:  # noqa: BLE001 - any Pillow/IO failure keeps the original usable
        logger.warning(
            "gallery_thumbnail_failed", extra={"file_path": relative_path}
        )
        return None
    return thumb_relative


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


async def save_upload(
    file: UploadFile, wedding_id: int
) -> tuple[str, str, int, str | None]:
    """Validate an image/video upload and persist it under the uploads dir.

    Returns (relative_path, content_type, file_size, thumb_path); thumb_path
    is None when no thumbnail could be generated (always the case for video).
    Raises 400 for unsupported types, 413 for payloads over the size cap.
    """
    content_type = file.content_type or ""
    if not (content_type.startswith("image/") or content_type == ALLOWED_VIDEO_TYPE):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image uploads or MP4 video uploads are allowed",
        )

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 150MB upload limit",
        )

    ext = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{ext}"
    relative_path = f"{wedding_id}/{stored_name}"

    uploads_dir = Path(get_uploads_dir())
    wedding_dir = uploads_dir / str(wedding_id)
    wedding_dir.mkdir(parents=True, exist_ok=True)

    destination = wedding_dir / stored_name
    destination.write_bytes(data)

    thumb_path = generate_thumbnail(uploads_dir, relative_path, content_type)
    return relative_path, content_type, len(data), thumb_path


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
    wedding_id = current_user.wedding_id
    relative_path, content_type, file_size, thumb_path = await save_upload(
        file, wedding_id
    )

    db_item = GalleryItem(
        wedding_id=wedding_id,
        title=title,
        caption=caption,
        file_path=relative_path,
        thumb_path=thumb_path,
        content_type=content_type,
        file_size=file_size,
        uploaded_by=current_user.name,
        status="approved",
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    logger.info("gallery_item_uploaded", extra={"gallery_item_id": db_item.id})
    return db_item


@router.post(
    "/submit",
    response_model=GalleryItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_gallery_item(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    caption: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> GalleryItem:
    wedding_id = current_user.wedding_id
    relative_path, content_type, file_size, thumb_path = await save_upload(
        file, wedding_id
    )

    db_item = GalleryItem(
        wedding_id=wedding_id,
        title=title,
        caption=caption,
        file_path=relative_path,
        thumb_path=thumb_path,
        content_type=content_type,
        file_size=file_size,
        uploaded_by=current_user.name,
        status="pending",
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    logger.info("gallery_item_submitted", extra={"gallery_item_id": db_item.id})
    return db_item


@router.get("/approved", response_model=list[GalleryItemResponse])
async def list_approved_gallery_items(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> list[GalleryItem]:
    return (
        db.query(GalleryItem)
        .filter(
            GalleryItem.wedding_id == current_user.wedding_id,
            GalleryItem.status == "approved",
        )
        .order_by(GalleryItem.created_at.desc(), GalleryItem.id.desc())
        .all()
    )


class ThumbnailBackfillResponse(BaseModel):
    generated: int
    skipped: int


@router.post("/thumbnails/backfill", response_model=ThumbnailBackfillResponse)
async def backfill_thumbnails(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> ThumbnailBackfillResponse:
    """Generate thumbnails for items that don't have one yet.

    Sequential and synchronous — the gallery is wedding-sized. Items whose
    original is missing on disk or whose format is unsupported are skipped.
    """
    rows = (
        db.query(GalleryItem)
        .filter(
            GalleryItem.wedding_id == current_user.wedding_id,
            GalleryItem.thumb_path.is_(None),
        )
        .order_by(GalleryItem.id.asc())
        .all()
    )
    uploads_dir = Path(get_uploads_dir())
    generated = 0
    for row in rows:
        if not (uploads_dir / row.file_path).is_file():
            continue
        thumb_path = generate_thumbnail(uploads_dir, row.file_path, row.content_type)
        if thumb_path is not None:
            row.thumb_path = thumb_path
            generated += 1
    db.commit()
    skipped = len(rows) - generated
    logger.info(
        "gallery_thumbnails_backfilled",
        extra={"generated": generated, "skipped": skipped},
    )
    return ThumbnailBackfillResponse(generated=generated, skipped=skipped)


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
    uploads_dir = Path(get_uploads_dir())
    file_paths = [uploads_dir / db_item.file_path]
    if db_item.thumb_path:
        file_paths.append(uploads_dir / db_item.thumb_path)

    db.delete(db_item)
    db.commit()

    # Best-effort file removal; a missing file should not fail the request.
    for file_path in file_paths:
        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            logger.warning(
                "gallery_item_file_unlink_failed", extra={"gallery_item_id": item_id}
            )

    logger.info("gallery_item_deleted", extra={"gallery_item_id": item_id})
    return {"status": "deleted", "id": item_id}
