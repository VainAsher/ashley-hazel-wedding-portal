import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Query as OrmQuery, Session

from app.api.auth import ROLE_GUEST, require_coordinator, require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import SongRequest
from app.db.schemas import (
    SongRequestCreate,
    SongRequestMerge,
    SongRequestResponse,
    SongRequestUpdate,
)
from app.logging import get_logger
from app.utils import music_metadata


router = APIRouter(prefix="/api/music", tags=["music"])
logger = get_logger(__name__)


def get_song_request_or_404(
    db: Session, request_id: int, wedding_id: int, action: str
) -> SongRequest:
    song_request = db.get(SongRequest, request_id)
    if song_request is None or song_request.wedding_id != wedding_id:
        logger.warning(
            "song_request_not_found",
            extra={"action": action, "song_request_id": request_id},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Song request not found"
        )
    return song_request


def wall_query(db: Session, wedding_id: int) -> OrmQuery[SongRequest]:
    """Approved requests in wall order: pinned first, then playlist position
    (nulls last), then submission order."""
    return (
        db.query(SongRequest)
        .filter(
            SongRequest.wedding_id == wedding_id,
            SongRequest.status == "approved",
        )
        .order_by(
            SongRequest.pinned.desc(),
            SongRequest.position.asc().nulls_last(),
            SongRequest.created_at.asc(),
            SongRequest.id.asc(),
        )
    )


@router.post(
    "/requests",
    response_model=SongRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_song_request(
    payload: SongRequestCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> SongRequest:
    # Guests may only submit while the wedding is live; the couple and
    # coordinators can seed the playlist in any phase.
    if current_user.role == ROLE_GUEST and current_user.wedding_phase != "live":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Song requests are not currently open.",
        )
    request_status = "pending" if current_user.role == ROLE_GUEST else "approved"

    db_request = SongRequest(
        wedding_id=current_user.wedding_id,
        title=payload.title,
        artist=payload.artist,
        source_url=payload.source_url,
        dedication=payload.dedication,
        requested_by=current_user.name,
        status=request_status,
    )
    if payload.source_url:
        # Best-effort: resolve_music_url never raises and returns None on
        # any failure, so a dead link still submits fine.
        metadata = music_metadata.resolve_music_url(payload.source_url)
        if metadata is not None:
            db_request.resolved_title = metadata.resolved_title
            db_request.resolved_artist = metadata.resolved_artist
            db_request.artwork_url = metadata.artwork_url
            db_request.spotify_track_id = metadata.spotify_track_id

    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    logger.info(
        "song_request_submitted",
        extra={"song_request_id": db_request.id, "status": request_status},
    )
    return db_request


@router.get("/requests/wall", response_model=list[SongRequestResponse])
async def list_song_wall(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> list[SongRequest]:
    return wall_query(db, current_user.wedding_id).all()


@router.get("/requests", response_model=list[SongRequestResponse])
async def list_song_requests(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[SongRequest]:
    return (
        db.query(SongRequest)
        .filter(SongRequest.wedding_id == current_user.wedding_id)
        .order_by(SongRequest.created_at.desc(), SongRequest.id.desc())
        .all()
    )


@router.patch("/requests/{request_id}", response_model=SongRequestResponse)
async def update_song_request(
    request_id: int,
    payload: SongRequestUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> SongRequest:
    db_request = get_song_request_or_404(
        db, request_id, current_user.wedding_id, "update_song_request"
    )
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_request, field, value)

    db.commit()
    db.refresh(db_request)
    logger.info("song_request_updated", extra={"song_request_id": request_id})
    return db_request


@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_song_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> None:
    db_request = get_song_request_or_404(
        db, request_id, current_user.wedding_id, "delete_song_request"
    )
    db.delete(db_request)
    db.commit()
    logger.info("song_request_deleted", extra={"song_request_id": request_id})


@router.post("/requests/{request_id}/merge", response_model=SongRequestResponse)
async def merge_song_requests(
    request_id: int,
    payload: SongRequestMerge,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> SongRequest:
    """Fold duplicate requests into the primary: dedications are joined,
    requester names deduped, and the duplicates deleted."""
    primary = get_song_request_or_404(
        db, request_id, current_user.wedding_id, "merge_song_requests"
    )
    duplicates: list[SongRequest] = []
    for duplicate_id in payload.duplicate_ids:
        if duplicate_id == primary.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A request cannot be merged into itself",
            )
        duplicate = db.get(SongRequest, duplicate_id)
        if duplicate is None:
            logger.warning(
                "song_request_not_found",
                extra={"action": "merge_song_requests", "song_request_id": duplicate_id},
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Song request not found"
            )
        if duplicate.wedding_id != current_user.wedding_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requests from another wedding cannot be merged",
            )
        duplicates.append(duplicate)

    dedications = [
        request.dedication
        for request in [primary, *duplicates]
        if request.dedication
    ]
    requesters: list[str] = []
    for request in [primary, *duplicates]:
        if request.requested_by not in requesters:
            requesters.append(request.requested_by)

    primary.dedication = " · ".join(dedications) or None
    primary.requested_by = ", ".join(requesters)
    for duplicate in duplicates:
        db.delete(duplicate)

    db.commit()
    db.refresh(primary)
    logger.info(
        "song_requests_merged",
        extra={
            "song_request_id": primary.id,
            "merged_count": len(duplicates),
        },
    )
    return primary


@router.get("/export")
async def export_dj_pack(
    export_format: Literal["csv", "text"] = Query("csv", alias="format"),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Response:
    approved = wall_query(db, current_user.wedding_id).all()

    if export_format == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            ["position", "title", "artist", "requested_by", "dedication", "source_url"]
        )
        for index, row in enumerate(approved, start=1):
            writer.writerow(
                [
                    index,
                    row.title,
                    row.artist or "",
                    row.requested_by,
                    row.dedication or "",
                    row.source_url or "",
                ]
            )
        logger.info("song_requests_exported", extra={"export_format": "csv"})
        return Response(
            content=buffer.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": 'attachment; filename="wedding-playlist.csv"'
            },
        )

    blocked = (
        db.query(SongRequest)
        .filter(
            SongRequest.wedding_id == current_user.wedding_id,
            SongRequest.status == "blocked",
        )
        .order_by(SongRequest.created_at.asc(), SongRequest.id.asc())
        .all()
    )
    lines = ["WEDDING PLAYLIST", "================", ""]
    for index, row in enumerate(approved, start=1):
        marker = "★ " if row.pinned else ""
        entry = f"{index}. {marker}{row.title}"
        if row.artist:
            entry += f" — {row.artist}"
        entry += f" (requested by {row.requested_by})"
        lines.append(entry)
        if row.dedication:
            lines.append(f"   Dedication: {row.dedication}")
    lines += ["", "DO NOT PLAY", "===========", ""]
    for row in blocked:
        entry = f"- {row.title}"
        if row.artist:
            entry += f" — {row.artist}"
        lines.append(entry)
    logger.info("song_requests_exported", extra={"export_format": "text"})
    return Response(
        content="\n".join(lines) + "\n",
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="dj-pack.txt"'},
    )
