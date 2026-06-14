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


def generate_invite_code(length: int = 10) -> str:
    """Generate a cryptographically random invite code."""
    return secrets.token_urlsafe(length)[:length].upper()


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
    )
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

    # Update fields if provided
    if invite_update.guest_id is not None:
        invite.guest_id = invite_update.guest_id
    if invite_update.household_name is not None:
        invite.household_name = invite_update.household_name

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
    db.delete(invite)
    db.commit()
