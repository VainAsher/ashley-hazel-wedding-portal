import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Invite, Wedding
from app.db.schemas import (
    InviteResponse,
    InviteCreate,
    InviteUpdate,
)
from app.api.auth import require_couple

router = APIRouter(prefix="/api/invites", tags=["invites"])

# Wave 3 item 14 D1: Best Man (stag) / Maid of Honour (hen) — friendly title
# auto-set when party_admin is flagged and no explicit title was supplied.
# Kept editable afterwards so the couple can use different wording.
DEFAULT_PARTY_TITLE = {"stag": "Best Man", "hen": "Maid of Honour"}

# The couple can name up to this many Best Man/Maid of Honour per party (was
# single-holder in D1; migration 024 dropped the DB-level backstop for this
# in favour of the app-level check below).
MAX_PARTY_ADMINS_PER_PARTY = 2


def generate_invite_code(length: int = 10) -> str:
    """Generate a cryptographically random invite code."""
    return secrets.token_urlsafe(length)[:length].upper()


def ensure_party_admin_capacity(
    db: Session, wedding_id: int, party: str, exclude_invite_id: int | None = None
) -> None:
    """Reject assigning a new Best Man/Maid of Honour once a party already
    holds MAX_PARTY_ADMINS_PER_PARTY of them.

    Deliberately rejects rather than auto-clearing an existing holder (the
    old single-holder behaviour) — with two slots, guessing which of two
    existing holders to silently demote would surprise the couple; they pick
    who to remove first instead.
    """
    query = db.query(Invite).filter(
        Invite.wedding_id == wedding_id,
        Invite.party == party,
        Invite.party_admin.is_(True),
    )
    if exclude_invite_id is not None:
        query = query.filter(Invite.id != exclude_invite_id)
    if query.count() >= MAX_PARTY_ADMINS_PER_PARTY:
        title = DEFAULT_PARTY_TITLE.get(party, "Best Man/Maid of Honour")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"This party already has {MAX_PARTY_ADMINS_PER_PARTY} {title}s — "
                "remove one before adding another."
            ),
        )


@router.post("", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
def create_invite(
    invite: InviteCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_couple),
) -> Invite:
    """Create a new invite code for a wedding."""
    # Verify user owns this wedding
    if invite.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create invites for other weddings"
        )

    # Verify wedding exists
    wedding = db.query(Wedding).filter(Wedding.id == invite.wedding_id).first()
    if not wedding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Wedding not found"
        )

    # Generate unique code
    while True:
        code = generate_invite_code()
        existing = db.query(Invite).filter(Invite.code == code).first()
        if not existing:
            break

    new_invite = Invite(
        code=code,
        wedding_id=invite.wedding_id,
        role=invite.role,
        guest_id=invite.guest_id,
        household_name=invite.household_name,
        party=invite.party,
        party_admin=invite.party_admin,
        party_title=invite.party_title,
        partner_label=invite.partner_label,
        associated_party=invite.associated_party,
    )

    if invite.party_admin and invite.party is not None:
        ensure_party_admin_capacity(db, invite.wedding_id, invite.party)
        if not new_invite.party_title:
            new_invite.party_title = DEFAULT_PARTY_TITLE.get(invite.party)

    db.add(new_invite)
    db.commit()
    db.refresh(new_invite)
    return new_invite


@router.get("", response_model=list[InviteResponse])
def list_invites(
    wedding_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_couple),
) -> list[Invite]:
    """List all invites for a wedding."""
    if wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access invites for other weddings"
        )
    invites = (
        db.query(Invite)
        .filter(Invite.wedding_id == wedding_id)
        .order_by(Invite.created_at.desc())
        .all()
    )
    return invites


@router.get("/{invite_id}", response_model=InviteResponse)
def get_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_couple),
) -> Invite:
    """Get a specific invite."""
    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )
    if invite.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )
    return invite


@router.patch("/{invite_id}", response_model=InviteResponse)
def update_invite(
    invite_id: int,
    invite_update: InviteUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_couple),
) -> Invite:
    """Update an invite (e.g., link to guest)."""
    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )
    if invite.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )

    # Snapshot before the field-assignment loop below mutates invite.party --
    # the party_admin capacity check needs to know whether this invite was
    # *already* admin of the target party specifically (not just admin of
    # whatever party it was in before this request, e.g. if it's switching
    # from stag to hen in the same PATCH).
    was_party_admin_of = invite.party if invite.party_admin else None

    # Update fields if provided
    if invite_update.guest_id is not None:
        invite.guest_id = invite_update.guest_id
    if invite_update.household_name is not None:
        invite.household_name = invite_update.household_name

    update_data = invite_update.model_dump(
        exclude_unset=True,
        include={"party", "party_title", "partner_label", "associated_party"},
    )
    for field, value in update_data.items():
        setattr(invite, field, value)

    if invite_update.party_admin is not None:
        target_party = update_data.get("party", invite.party)
        if invite_update.party_admin:
            if target_party is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="party_admin requires a party",
                )
            if was_party_admin_of != target_party:
                ensure_party_admin_capacity(
                    db, invite.wedding_id, target_party, exclude_invite_id=invite.id
                )
            invite.party_admin = True
            if not invite.party_title:
                invite.party_title = DEFAULT_PARTY_TITLE.get(target_party)
        else:
            invite.party_admin = False

    db.commit()
    db.refresh(invite)
    return invite


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_couple),
) -> None:
    """Delete an invite."""
    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )
    if invite.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )
    db.delete(invite)
    db.commit()
