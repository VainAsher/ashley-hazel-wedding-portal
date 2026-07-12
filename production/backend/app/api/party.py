"""Stag & Hen party portals (Wave 3 item 14 D1).

See docs/specs/PARTY_PORTALS_D1.md for the full contract. This is the most
privacy-sensitive surface in the app: `has_party_access` is the single
source of truth for whether an invite may see a party's content, and every
content endpoint below calls it directly rather than duplicating the rule.

Access rule (verbatim from the spec):

    For a guest-role invite: allowed iff invite.party == party.

    For a couple-role invite requesting party P:
        is_subject = invite.associated_party == P
        row = party_reveals row for (wedding, P, invite.id), if any
        if is_subject:
            allowed = row.revealed if row exists else False
        else:  # P is their partner's party, not their own
            if row exists:
                allowed = row.revealed
            else:
                allowed = wedding.party_visibility_mode == 'partner_visible'

    Coordinators do NOT get automatic access to party content — this is
    deliberately the one guest-facing surface coordinators can't see by
    default. They keep full admin control of the mechanics (membership,
    Best Man/MoH, the visibility-mode dial, and the reveal toggles as a
    fallback) via the existing admin pages, just not read access to the
    party's own social content.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import ROLE_COORDINATOR, ROLE_COUPLE, ROLE_GUEST, require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Invite, PartyInfo, PartyMessage, PartyReveal, Wedding
from app.db.schemas import (
    PartyAccessResponse,
    PartyInfoResponse,
    PartyInfoUpdate,
    PartyMemberResponse,
    PartyMessageCreate,
    PartyMessageModerate,
    PartyMessageResponse,
    PartyRevealBanner,
    PartyRevealResponse,
    PartyRevealUpdate,
    PartySummaryResponse,
)
from app.logging import get_logger
from app.utils.mentions import fan_out_mentions, party_scope_directory


router = APIRouter(prefix="/api/party", tags=["party"])
logger = get_logger(__name__)

PartyName = Literal["stag", "hen"]

DEFAULT_PARTY_TITLE = {"stag": "Best Man", "hen": "Maid of Honour"}


# ---------------------------------------------------------------------------
# The access rule — the security-critical part of this whole feature.
# Every party content/mutation endpoint below calls this (or is_party_admin_for)
# rather than re-deriving the rule inline.
# ---------------------------------------------------------------------------


def has_party_access(invite: Invite, party: str, db: Session) -> bool:
    """Pure function implementing the D1 spec's "Access rule" exactly.

    `invite` must already be confirmed to belong to the wedding being asked
    about — this function does not itself check wedding scoping.
    """
    if invite.role == ROLE_GUEST:
        return invite.party == party

    if invite.role != ROLE_COUPLE:
        # Coordinators (and any other role) never get automatic party
        # content access — deliberate, see module docstring.
        return False

    is_subject = invite.associated_party == party
    row = (
        db.query(PartyReveal)
        .filter(
            PartyReveal.wedding_id == invite.wedding_id,
            PartyReveal.party == party,
            PartyReveal.invite_id == invite.id,
        )
        .first()
    )

    if is_subject:
        return bool(row.revealed) if row is not None else False

    if row is not None:
        return bool(row.revealed)

    wedding = db.get(Wedding, invite.wedding_id)
    return wedding is not None and wedding.party_visibility_mode == "partner_visible"


def is_party_admin_for(invite: Invite, party: str) -> bool:
    """Best Man / Maid of Honour check: a guest invite flagged party_admin
    for exactly this party. Couple/coordinator invites are never a party's
    admin in this sense (party_admin is a guest-only flag, see the D1 spec)."""
    return invite.role == ROLE_GUEST and invite.party == party and bool(invite.party_admin)


def can_toggle_reveal(actor: Invite, target: Invite, party: str, db: Session) -> bool:
    """Authorization for PATCH /api/party/{party}/reveal.

    A party_reveals row keyed by (party, target invite) means one of two
    things depending on whether target is that party's subject:
      - target IS the subject: the "reveal it to them" flag.
      - target is NOT the subject (i.e. their partner): their own initial
        access grant to that party (relevant in 'locked' mode).

    - coordinator: always, for either couple member's row.
    - that party's admin (Best Man/MoH): always, for either couple member's
      row in their party (both the subject's reveal AND, in locked mode,
      granting the non-subject their own access).
    - the non-subject partner may toggle ONLY the subject's row, and only
      once they themselves currently have access to that party.
    - the subject themself: never (can't self-reveal, and can't grant their
      own partner access either).
    """
    if actor.wedding_id != target.wedding_id:
        return False
    if target.role != ROLE_COUPLE:
        return False

    if actor.role == ROLE_COORDINATOR:
        return True

    if is_party_admin_for(actor, party):
        return True

    if actor.role == ROLE_COUPLE:
        if actor.id == target.id:
            return False  # never self-service, either as subject or grantor
        # A couple-role actor may only ever toggle the SUBJECT's reveal row,
        # and only once they themselves already have access to that party
        # (i.e. they are that party's non-subject and are not locked out).
        if target.associated_party != party:
            return False
        if actor.associated_party == party:
            return False  # actor is (somehow) also a subject of this party
        return has_party_access(actor, party, db)

    return False


def _current_invite(db: Session, current_user: UserResponse) -> Invite:
    invite = db.get(Invite, current_user.invite_id)
    if invite is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return invite


def _author_display_name(invite: Invite) -> str:
    guest = invite.guest
    if guest is not None:
        return guest.name
    if invite.household_name:
        return invite.household_name
    return f"{invite.role.title()} Invite"


def _get_or_create_reveal(
    db: Session, wedding_id: int, party: str, invite_id: int
) -> PartyReveal:
    row = (
        db.query(PartyReveal)
        .filter(
            PartyReveal.wedding_id == wedding_id,
            PartyReveal.party == party,
            PartyReveal.invite_id == invite_id,
        )
        .first()
    )
    if row is None:
        row = PartyReveal(wedding_id=wedding_id, party=party, invite_id=invite_id)
        db.add(row)
    return row


def _get_message_or_404(db: Session, message_id: int, wedding_id: int) -> PartyMessage:
    message = db.get(PartyMessage, message_id)
    if message is None or message.wedding_id != wedding_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Message not found")
    return message


@router.get("/access", response_model=PartyAccessResponse)
async def get_party_access(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> PartyAccessResponse:
    invite = _current_invite(db, current_user)
    return PartyAccessResponse(
        stag=has_party_access(invite, "stag", db),
        hen=has_party_access(invite, "hen", db),
    )


@router.get("/{party}/summary", response_model=PartySummaryResponse)
async def get_party_summary(
    party: PartyName,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> PartySummaryResponse:
    invite = _current_invite(db, current_user)
    if not has_party_access(invite, party, db):
        logger.warning(
            "party_summary_denied",
            extra={"wedding_id": current_user.wedding_id, "party": party},
        )
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized")

    viewer_is_admin = is_party_admin_for(invite, party)

    info = db.get(PartyInfo, (current_user.wedding_id, party))

    members = (
        db.query(Invite)
        .filter(
            Invite.wedding_id == current_user.wedding_id,
            Invite.role == ROLE_GUEST,
            Invite.party == party,
        )
        .order_by(Invite.id)
        .all()
    )

    messages_query = db.query(PartyMessage).filter(
        PartyMessage.wedding_id == current_user.wedding_id,
        PartyMessage.party == party,
    )
    if not viewer_is_admin:
        messages_query = messages_query.filter(PartyMessage.hidden.is_(False))
    messages = messages_query.order_by(
        PartyMessage.pinned.desc(), PartyMessage.created_at.desc(), PartyMessage.id.desc()
    ).all()

    reveal_banner = None
    if invite.role == ROLE_COUPLE and invite.associated_party != party:
        # Normal use has at most one couple invite per (wedding, party), but
        # order deterministically regardless — a misconfigured wedding with
        # two should still get a stable, not arbitrary, answer.
        subject = (
            db.query(Invite)
            .filter(
                Invite.wedding_id == current_user.wedding_id,
                Invite.role == ROLE_COUPLE,
                Invite.associated_party == party,
            )
            .order_by(Invite.id)
            .first()
        )
        if subject is not None:
            row = (
                db.query(PartyReveal)
                .filter(
                    PartyReveal.wedding_id == current_user.wedding_id,
                    PartyReveal.party == party,
                    PartyReveal.invite_id == subject.id,
                )
                .first()
            )
            reveal_banner = PartyRevealBanner(
                subject_invite_id=subject.id,
                subject_name=_author_display_name(subject),
                revealed=bool(row.revealed) if row is not None else False,
            )

    return PartySummaryResponse(
        party=party,
        is_party_admin=viewer_is_admin,
        info=PartyInfoResponse(
            details=info.details if info else None,
            updated_at=info.updated_at if info else None,
        ),
        reveal_banner=reveal_banner,
        members=[
            PartyMemberResponse(
                invite_id=member.id,
                name=_author_display_name(member),
                party_admin=member.party_admin,
                party_title=member.party_title,
            )
            for member in members
        ],
        messages=[
            PartyMessageResponse(
                id=message.id,
                author_name=_author_display_name(message.author),
                author_invite_id=message.invite_id,
                message=message.message,
                hidden=message.hidden,
                pinned=message.pinned,
                created_at=message.created_at,
            )
            for message in messages
        ],
    )


@router.post(
    "/{party}/messages",
    response_model=PartyMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_party_message(
    party: PartyName,
    payload: PartyMessageCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> PartyMessageResponse:
    invite = _current_invite(db, current_user)
    if not has_party_access(invite, party, db):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized")

    message = PartyMessage(
        wedding_id=current_user.wedding_id,
        party=party,
        invite_id=invite.id,
        message=payload.message,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    logger.info(
        "party_message_created",
        extra={"wedding_id": current_user.wedding_id, "party": party, "message_id": message.id},
    )

    do_name = "Stag Do" if party == "stag" else "Hen Do"
    directory = party_scope_directory(db, current_user.wedding_id, party)
    fan_out_mentions(
        db,
        wedding_id=current_user.wedding_id,
        author_invite_id=invite.id,
        author_display_name=_author_display_name(invite),
        text=message.message,
        directory=directory,
        context_phrase=f"a {do_name} message",
        link_path=f"/party/{party}",
    )
    db.commit()

    return PartyMessageResponse(
        id=message.id,
        author_name=_author_display_name(invite),
        author_invite_id=message.invite_id,
        message=message.message,
        hidden=message.hidden,
        pinned=message.pinned,
        created_at=message.created_at,
    )


@router.patch("/{party}/messages/{message_id}", response_model=PartyMessageResponse)
async def moderate_party_message(
    party: PartyName,
    message_id: int,
    payload: PartyMessageModerate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> PartyMessageResponse:
    invite = _current_invite(db, current_user)
    if not is_party_admin_for(invite, party):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized")

    message = _get_message_or_404(db, message_id, current_user.wedding_id)
    if message.party != party:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Message not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(message, field, value)

    db.commit()
    db.refresh(message)
    logger.info(
        "party_message_moderated",
        extra={
            "wedding_id": current_user.wedding_id,
            "party": party,
            "message_id": message.id,
            "updated_fields": sorted(update_data.keys()),
        },
    )
    return PartyMessageResponse(
        id=message.id,
        author_name=_author_display_name(message.author),
        author_invite_id=message.invite_id,
        message=message.message,
        hidden=message.hidden,
        pinned=message.pinned,
        created_at=message.created_at,
    )


@router.put("/{party}/info", response_model=PartyInfoResponse)
async def update_party_info(
    party: PartyName,
    payload: PartyInfoUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> PartyInfoResponse:
    invite = _current_invite(db, current_user)
    if not is_party_admin_for(invite, party):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized")

    info = db.get(PartyInfo, (current_user.wedding_id, party))
    if info is None:
        info = PartyInfo(wedding_id=current_user.wedding_id, party=party)
        db.add(info)

    info.details = payload.details
    db.commit()
    db.refresh(info)
    logger.info(
        "party_info_updated",
        extra={"wedding_id": current_user.wedding_id, "party": party},
    )
    return PartyInfoResponse(details=info.details, updated_at=info.updated_at)


@router.patch("/{party}/reveal", response_model=PartyRevealResponse)
async def set_party_reveal(
    party: PartyName,
    payload: PartyRevealUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> PartyRevealResponse:
    actor = _current_invite(db, current_user)

    target = db.get(Invite, payload.invite_id)
    if (
        target is None
        or target.wedding_id != current_user.wedding_id
        or target.role != ROLE_COUPLE
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if not can_toggle_reveal(actor, target, party, db):
        logger.warning(
            "party_reveal_denied",
            extra={
                "wedding_id": current_user.wedding_id,
                "party": party,
                "actor_invite_id": actor.id,
                "target_invite_id": target.id,
            },
        )
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized")

    row = _get_or_create_reveal(db, current_user.wedding_id, party, target.id)
    row.revealed = payload.revealed
    db.commit()
    db.refresh(row)
    logger.info(
        "party_reveal_updated",
        extra={
            "wedding_id": current_user.wedding_id,
            "party": party,
            "target_invite_id": target.id,
            "revealed": row.revealed,
        },
    )
    return PartyRevealResponse(party=party, invite_id=target.id, revealed=row.revealed)
