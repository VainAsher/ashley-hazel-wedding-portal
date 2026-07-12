"""@mentions (Wave 3 item 16, closes the wave).

See docs/specs/MENTIONS.md for the full contract. Per the roadmap: **store
nothing new beyond `notifications`** — mentions are derived fresh from plain
text against a live, scoped directory both when a message is saved (to fire
notifications, this module's `fan_out_mentions`) and when it's rendered (to
highlight the match, mirrored client-side — see the frontend's shared parsing
helper). Never trust a client-supplied list of who was mentioned.

The two directory builders below deliberately mirror existing query shapes
rather than inventing a new one:
  - `general_scope_directory` reuses `app/api/profiles.py`'s `list_profiles`
    filter (`Invite.party.isnot(None)`) for the wedding-party half, plus
    labelled couple invites.
  - `party_scope_directory` reuses `app/api/party.py`'s `get_party_summary`
    members population (`Invite.role == 'guest', Invite.party == party`) —
    the same population `has_party_access`'s guest branch checks against.
"""

from sqlalchemy.orm import Session

from app.api.auth import ROLE_COUPLE, ROLE_GUEST
from app.api.communications import NOTIFICATION_TITLE_MAX
from app.api.profiles import _fallback_display_name
from app.db.models import Invite, MemberProfile, Notification

# "A short excerpt of the text" for the notification body -- long enough to
# give context, short enough to stay a teaser (the full message is one click
# away via link_path).
EXCERPT_MAX = 160


def extract_mentioned_invite_ids(
    text: str, directory: list[tuple[int, str]]
) -> set[int]:
    """For each `@` in `text`, greedily match the longest directory display
    name that starts immediately after it (case-insensitive).

    Pure function, unit-testable in isolation without any DB. Self-exclusion
    (a mention of the author themself is a no-op) is the caller's job --
    this function has no notion of "author", only text + directory.
    """
    if not text or not directory:
        return set()

    # Longest name first so "Alex Smith" wins over a shorter "Alex" when both
    # are candidates for the same "@" -- see the module docstring / spec.
    ordered = sorted(directory, key=lambda pair: len(pair[1]), reverse=True)
    lower_text = text.lower()

    found: set[int] = set()
    for index, char in enumerate(text):
        if char != "@":
            continue
        remainder = lower_text[index + 1 :]
        for invite_id, display_name in ordered:
            if not display_name:
                continue
            if remainder.startswith(display_name.lower()):
                found.add(invite_id)
                break
    return found


def general_scope_directory(db: Session, wedding_id: int) -> list[tuple[int, str]]:
    """Mentionable directory for blessings / song dedications: wedding-party
    members (exactly `profiles.py`'s `list_profiles` filter) plus labelled
    couple invites. NOT the full guest list -- see docs/specs/MENTIONS.md."""
    rows = (
        db.query(Invite, MemberProfile)
        .outerjoin(MemberProfile, MemberProfile.invite_id == Invite.id)
        .filter(Invite.wedding_id == wedding_id, Invite.party.isnot(None))
        .all()
    )
    directory = [
        (
            invite.id,
            (profile.display_name if profile else None) or _fallback_display_name(invite),
        )
        for invite, profile in rows
    ]

    couples = (
        db.query(Invite)
        .filter(Invite.wedding_id == wedding_id, Invite.role == ROLE_COUPLE)
        .all()
    )
    directory.extend(
        (invite.id, invite.partner_label.strip())
        for invite in couples
        if invite.partner_label and invite.partner_label.strip()
    )
    return directory


def party_scope_directory(db: Session, wedding_id: int, party: str) -> list[tuple[int, str]]:
    """Mentionable directory for a Stag/Hen party message: that party's
    members only, the same population `party.py`'s `get_party_summary`
    queries for (and the same one `has_party_access`'s guest branch checks
    against)."""
    rows = (
        db.query(Invite, MemberProfile)
        .outerjoin(MemberProfile, MemberProfile.invite_id == Invite.id)
        .filter(
            Invite.wedding_id == wedding_id,
            Invite.role == ROLE_GUEST,
            Invite.party == party,
        )
        .all()
    )
    return [
        (
            invite.id,
            (profile.display_name if profile else None) or _fallback_display_name(invite),
        )
        for invite, profile in rows
    ]


def fan_out_mentions(
    db: Session,
    *,
    wedding_id: int,
    author_invite_id: int,
    author_display_name: str,
    text: str,
    directory: list[tuple[int, str]],
    context_phrase: str,
    link_path: str,
) -> int:
    """Create one `kind='mention'` notification per genuinely-mentioned
    invite (excluding the author mentioning themself, which is a no-op).

    Mirrors the inline `Notification(...)` shape `app/api/communications.py`'s
    `send_communication` already uses -- there's no shared helper to import
    (checked), so this is the equivalent for the mention fan-out's 3 call
    sites. Returns the number of notifications created (mainly for logging).
    """
    mentioned_ids = extract_mentioned_invite_ids(text, directory) - {author_invite_id}
    if not mentioned_ids:
        return 0

    title = f"{author_display_name} mentioned you in {context_phrase}"[:NOTIFICATION_TITLE_MAX]
    body = text if len(text) <= EXCERPT_MAX else text[: EXCERPT_MAX - 1].rstrip() + "…"

    for invite_id in mentioned_ids:
        db.add(
            Notification(
                wedding_id=wedding_id,
                recipient_invite_id=invite_id,
                kind="mention",
                title=title,
                body=body,
                link_path=link_path,
            )
        )
    return len(mentioned_ids)
