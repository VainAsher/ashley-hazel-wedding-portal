"""Wedding-party mini profiles (Wave 3 item 15).

See docs/specs/WEDDING_PARTY_PROFILES.md for the full contract. Profiles are
guest-visible, not party-only: the directory (`GET /api/profiles`) is open to
every logged-in guest with no party-based filtering, while the "me" endpoints
are gated on eligibility (any invite with `party IS NOT NULL`).

`member_profiles` carries no `wedding_id` of its own — it only has a unique
FK to `invites`. Every query here that must stay wedding-scoped therefore
joins through `Invite.wedding_id` rather than trusting anything on the
profile row directly.
"""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.auth import require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Invite, MemberProfile
from app.db.schemas import MemberProfileResponse, MemberProfileUpdate, ProfileDirectoryEntry
from app.logging import get_logger


router = APIRouter(prefix="/api/profiles", tags=["profiles"])
logger = get_logger(__name__)


def get_uploads_dir() -> str:
    # Read lazily so tests can override UPLOADS_DIR at runtime.
    return os.environ.get("UPLOADS_DIR", "uploads")


def _current_invite(db: Session, current_user: UserResponse) -> Invite:
    invite = db.get(Invite, current_user.invite_id)
    if invite is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return invite


def _fallback_display_name(invite: Invite) -> str:
    guest = invite.guest
    if guest is not None:
        return guest.name
    if invite.household_name:
        return invite.household_name
    return f"{invite.role.title()} Invite"


def _get_profile(db: Session, invite_id: int) -> MemberProfile | None:
    return db.query(MemberProfile).filter(MemberProfile.invite_id == invite_id).first()


def _get_or_create_profile(db: Session, invite_id: int) -> MemberProfile:
    profile = _get_profile(db, invite_id)
    if profile is None:
        profile = MemberProfile(invite_id=invite_id)
        db.add(profile)
    return profile


@router.get("/me", response_model=MemberProfileResponse)
async def get_my_profile(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> MemberProfileResponse:
    invite = _current_invite(db, current_user)
    if invite.party is None:
        logger.warning("member_profile_not_eligible", extra={"invite_id": invite.id})
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not eligible for a profile")

    profile = _get_profile(db, invite.id)
    if profile is None:
        # Eligible, just hasn't saved one yet: 200 with empty fields, NOT a
        # 404 -- the frontend needs to tell these two states apart.
        return MemberProfileResponse(invite_id=invite.id)
    return MemberProfileResponse.model_validate(profile)


@router.put("/me", response_model=MemberProfileResponse)
async def update_my_profile(
    payload: MemberProfileUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> MemberProfileResponse:
    invite = _current_invite(db, current_user)
    if invite.party is None:
        logger.warning("member_profile_update_denied", extra={"invite_id": invite.id})
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized")

    profile = _get_or_create_profile(db, invite.id)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    logger.info("member_profile_updated", extra={"invite_id": invite.id})
    return MemberProfileResponse.model_validate(profile)


@router.post("/me/photo", response_model=MemberProfileResponse)
async def upload_my_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> MemberProfileResponse:
    invite = _current_invite(db, current_user)
    if invite.party is None:
        logger.warning("member_profile_photo_denied", extra={"invite_id": invite.id})
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized")

    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image uploads are allowed",
        )

    ext = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{ext}"
    # Own subfolder, distinct from gallery_items -- no moderation queue, no
    # thumbnail derivative, a different lifecycle entirely (see module docstring).
    relative_path = f"{current_user.wedding_id}/profiles/{stored_name}"

    uploads_dir = Path(get_uploads_dir())
    profile_dir = uploads_dir / str(current_user.wedding_id) / "profiles"
    profile_dir.mkdir(parents=True, exist_ok=True)

    data = await file.read()
    (uploads_dir / relative_path).write_bytes(data)

    profile = _get_or_create_profile(db, invite.id)
    profile.photo_path = relative_path

    db.commit()
    db.refresh(profile)
    logger.info("member_profile_photo_uploaded", extra={"invite_id": invite.id})
    return MemberProfileResponse.model_validate(profile)


@router.get("", response_model=list[ProfileDirectoryEntry])
async def list_profiles(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> list[ProfileDirectoryEntry]:
    rows = (
        db.query(Invite, MemberProfile)
        .outerjoin(MemberProfile, MemberProfile.invite_id == Invite.id)
        .filter(
            Invite.wedding_id == current_user.wedding_id,
            Invite.party.isnot(None),
        )
        .all()
    )

    entries = [
        ProfileDirectoryEntry(
            invite_id=invite.id,
            party=invite.party,
            display_name=(profile.display_name if profile else None)
            or _fallback_display_name(invite),
            role_title=(profile.role_title if profile else None) or invite.party_title,
            about=profile.about if profile else None,
            best_known_for=profile.best_known_for if profile else None,
            favourite_song=profile.favourite_song if profile else None,
            photo_path=profile.photo_path if profile else None,
            has_profile=profile is not None,
        )
        for invite, profile in rows
    ]
    entries.sort(key=lambda entry: (entry.party, entry.display_name.lower()))
    return entries
