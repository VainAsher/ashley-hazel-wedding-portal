import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Query as OrmQuery, Session

from app.api.auth import ROLE_GUEST, require_coordinator, require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import SongReaction, SongRequest, Wedding
from app.db.schemas import (
    AdminSongRequestResponse,
    NowPlayingResponse,
    NowPlayingUpdate,
    SongReactionState,
    SongRequestCreate,
    SongRequestMerge,
    SongRequestResponse,
    SongRequestUpdate,
    SongWallItem,
    SongWallResponse,
)
from app.logging import get_logger
from app.utils import music_metadata, music_previews
from app.utils.mentions import fan_out_mentions, general_scope_directory


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


def reaction_stats(
    db: Session, song_ids: list[int], invite_id: int
) -> dict[int, tuple[int, bool]]:
    """Reaction count + "did this invite react?" per song, in ONE query."""
    if not song_ids:
        return {}
    rows = (
        db.query(
            SongReaction.song_request_id,
            func.count(SongReaction.id),
            func.bool_or(SongReaction.invite_id == invite_id),
        )
        .filter(SongReaction.song_request_id.in_(song_ids))
        .group_by(SongReaction.song_request_id)
        .all()
    )
    return {song_id: (count, bool(mine)) for song_id, count, mine in rows}


def to_wall_item(
    song: SongRequest, stats: dict[int, tuple[int, bool]]
) -> SongWallItem:
    item = SongWallItem.model_validate(song)
    item.reaction_count, item.reacted_by_me = stats.get(song.id, (0, False))
    return item


def get_wall_song_or_404(
    db: Session, request_id: int, wedding_id: int, action: str
) -> SongRequest:
    """Reactions target only wall-visible (approved) songs — 404 otherwise."""
    song_request = get_song_request_or_404(db, request_id, wedding_id, action)
    if song_request.status != "approved":
        logger.warning(
            "song_request_not_on_wall",
            extra={"action": action, "song_request_id": request_id},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Song request not found"
        )
    return song_request


def apply_preview_match(db_request: SongRequest) -> bool:
    """Best-effort 30s preview match for the jukebox. Returns True on match.

    Fills preview_url plus (only where the row has none) artwork and resolved
    title/artist. Never raises — find_preview is best-effort by contract.
    """
    match = music_previews.find_preview(db_request.title, db_request.artist)
    if match is None:
        return False
    db_request.preview_url = match.preview_url
    if not db_request.artwork_url:
        db_request.artwork_url = match.artwork_url
    if not db_request.resolved_title:
        db_request.resolved_title = match.matched_title
    if not db_request.resolved_artist:
        db_request.resolved_artist = match.matched_artist
    return True


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

    if request_status == "approved":
        # Coordinator-created songs go straight onto the playlist, so match a
        # jukebox preview immediately (guests' requests match on approval).
        apply_preview_match(db_request)

    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    logger.info(
        "song_request_submitted",
        extra={"song_request_id": db_request.id, "status": request_status},
    )

    # Only the dedication is scanned for mentions -- title/artist never are
    # (docs/specs/MENTIONS.md).
    if db_request.dedication:
        directory = general_scope_directory(db, current_user.wedding_id)
        fan_out_mentions(
            db,
            wedding_id=current_user.wedding_id,
            author_invite_id=current_user.invite_id,
            author_display_name=db_request.requested_by,
            text=db_request.dedication,
            directory=directory,
            context_phrase="a song dedication",
            link_path="/music",
        )
        db.commit()

    return db_request


@router.get("/requests/wall", response_model=SongWallResponse)
async def list_song_wall(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> SongWallResponse:
    songs = wall_query(db, current_user.wedding_id).all()
    stats = reaction_stats(db, [song.id for song in songs], current_user.invite_id)
    items = [to_wall_item(song, stats) for song in songs]

    # The now-playing pick is always an approved song, so serve it from the
    # wall items we already built (None if it slipped off the wall since).
    wedding = db.get(Wedding, current_user.wedding_id)
    now_playing = None
    if wedding is not None and wedding.now_playing_song_id is not None:
        now_playing = next(
            (item for item in items if item.id == wedding.now_playing_song_id), None
        )
    return SongWallResponse(songs=items, now_playing=now_playing)


@router.get("/requests", response_model=list[AdminSongRequestResponse])
async def list_song_requests(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[AdminSongRequestResponse]:
    songs = (
        db.query(SongRequest)
        .filter(SongRequest.wedding_id == current_user.wedding_id)
        .order_by(SongRequest.created_at.desc(), SongRequest.id.desc())
        .all()
    )
    stats = reaction_stats(db, [song.id for song in songs], current_user.invite_id)
    items = []
    for song in songs:
        item = AdminSongRequestResponse.model_validate(song)
        item.reaction_count = stats.get(song.id, (0, False))[0]
        items.append(item)
    return items


@router.post(
    "/requests/{request_id}/react",
    response_model=SongReactionState,
)
async def react_to_song(
    request_id: int,
    response: Response,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> SongReactionState:
    """♥ a wall song. Idempotent: reacting twice keeps a single reaction."""
    song = get_wall_song_or_404(db, request_id, current_user.wedding_id, "react")
    existing = (
        db.query(SongReaction)
        .filter(
            SongReaction.song_request_id == song.id,
            SongReaction.invite_id == current_user.invite_id,
        )
        .first()
    )
    if existing is None:
        db.add(
            SongReaction(song_request_id=song.id, invite_id=current_user.invite_id)
        )
        try:
            db.commit()
            response.status_code = status.HTTP_201_CREATED
            logger.info("song_reacted", extra={"song_request_id": song.id})
        except IntegrityError:
            # Lost a race with a concurrent double-tap — the reaction exists.
            db.rollback()

    count = (
        db.query(func.count(SongReaction.id))
        .filter(SongReaction.song_request_id == song.id)
        .scalar()
        or 0
    )
    return SongReactionState(reaction_count=count, reacted_by_me=True)


@router.delete(
    "/requests/{request_id}/react", status_code=status.HTTP_204_NO_CONTENT
)
async def unreact_to_song(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> None:
    """Remove this member's ♥. Idempotent: a no-op when none exists."""
    song = get_wall_song_or_404(db, request_id, current_user.wedding_id, "unreact")
    removed = (
        db.query(SongReaction)
        .filter(
            SongReaction.song_request_id == song.id,
            SongReaction.invite_id == current_user.invite_id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    if removed:
        logger.info("song_unreacted", extra={"song_request_id": song.id})


@router.get("/now-playing", response_model=NowPlayingResponse)
async def get_now_playing(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> NowPlayingResponse:
    wedding = db.get(Wedding, current_user.wedding_id)
    if wedding is None or wedding.now_playing_song_id is None:
        return NowPlayingResponse(now_playing=None)
    song = db.get(SongRequest, wedding.now_playing_song_id)
    if song is None or song.status != "approved":
        return NowPlayingResponse(now_playing=None)
    stats = reaction_stats(db, [song.id], current_user.invite_id)
    return NowPlayingResponse(now_playing=to_wall_item(song, stats))


@router.put("/now-playing", response_model=NowPlayingResponse)
async def set_now_playing(
    payload: NowPlayingUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> NowPlayingResponse:
    """Pick the wedding-day "currently playing" song; null clears it."""
    wedding = db.get(Wedding, current_user.wedding_id)
    if wedding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Wedding not found"
        )

    if payload.song_request_id is None:
        wedding.now_playing_song_id = None
        db.commit()
        logger.info("now_playing_cleared")
        return NowPlayingResponse(now_playing=None)

    song = get_wall_song_or_404(
        db, payload.song_request_id, current_user.wedding_id, "set_now_playing"
    )
    wedding.now_playing_song_id = song.id
    db.commit()
    logger.info("now_playing_set", extra={"song_request_id": song.id})
    stats = reaction_stats(db, [song.id], current_user.invite_id)
    return NowPlayingResponse(now_playing=to_wall_item(song, stats))


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
    became_approved = (
        update_data.get("status") == "approved" and db_request.status != "approved"
    )
    for field, value in update_data.items():
        setattr(db_request, field, value)

    if became_approved and not db_request.preview_url:
        apply_preview_match(db_request)

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


@router.post("/requests/{request_id}/match-preview", response_model=SongRequestResponse)
async def match_song_preview(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> SongRequest:
    """(Re-)match a song's 30s jukebox preview against iTunes."""
    db_request = get_song_request_or_404(
        db, request_id, current_user.wedding_id, "match_song_preview"
    )
    matched = apply_preview_match(db_request)
    db.commit()
    db.refresh(db_request)
    logger.info(
        "song_preview_matched",
        extra={"song_request_id": request_id, "matched": matched},
    )
    return db_request


class PreviewBackfillResponse(BaseModel):
    matched: int
    missed: int


@router.post("/previews/backfill", response_model=PreviewBackfillResponse)
async def backfill_previews(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> PreviewBackfillResponse:
    """Match previews for every approved song that doesn't have one yet.

    Sequential and synchronous — the playlist is wedding-sized, and the
    matcher's 3s timeout bounds the worst case.
    """
    rows = (
        db.query(SongRequest)
        .filter(
            SongRequest.wedding_id == current_user.wedding_id,
            SongRequest.status == "approved",
            SongRequest.preview_url.is_(None),
        )
        .order_by(SongRequest.id.asc())
        .all()
    )
    matched = sum(1 for row in rows if apply_preview_match(row))
    db.commit()
    logger.info(
        "song_previews_backfilled",
        extra={"matched": matched, "missed": len(rows) - matched},
    )
    return PreviewBackfillResponse(matched=matched, missed=len(rows) - matched)


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
