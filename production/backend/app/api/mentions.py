"""@mentions directory (Wave 3 item 16, closes the wave).

See docs/specs/MENTIONS.md for the full contract, especially the scoping
rule this endpoint enforces: guests must never be able to discover the full
guest list through autocomplete. `scope=stag`/`hen` additionally requires
the caller actually be a member of that party -- reusing `party.py`'s
`has_party_access` (the same check every other party content endpoint uses)
rather than re-deriving membership differently, so a guest can't probe a
party's roster by guessing the scope query param.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import require_guest
from app.api.party import has_party_access
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Invite
from app.db.schemas import MentionDirectoryEntry
from app.logging import get_logger
from app.utils.mentions import general_scope_directory, party_scope_directory


router = APIRouter(prefix="/api/mentions", tags=["mentions"])
logger = get_logger(__name__)

MentionScope = Literal["general", "stag", "hen"]


def _current_invite(db: Session, current_user: UserResponse) -> Invite:
    invite = db.get(Invite, current_user.invite_id)
    if invite is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return invite


@router.get("/directory", response_model=list[MentionDirectoryEntry])
async def get_mentions_directory(
    scope: MentionScope = Query(...),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> list[MentionDirectoryEntry]:
    if scope == "general":
        directory = general_scope_directory(db, current_user.wedding_id)
    else:
        invite = _current_invite(db, current_user)
        if not has_party_access(invite, scope, db):
            logger.warning(
                "mentions_directory_denied",
                extra={"wedding_id": current_user.wedding_id, "scope": scope},
            )
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized")
        directory = party_scope_directory(db, current_user.wedding_id, scope)

    entries = [
        MentionDirectoryEntry(invite_id=invite_id, display_name=display_name)
        for invite_id, display_name in directory
    ]
    entries.sort(key=lambda entry: entry.display_name.lower())
    return entries
