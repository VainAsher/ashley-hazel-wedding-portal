#!/usr/bin/env python3
"""Bootstrap a PRODUCTION wedding.

Creates the real wedding row (phase='planning') and the couple + coordinator
invite codes. No demo guests, no demo codes — production starts empty apart from
this. Run ONCE against the production database, e.g. inside the prod container:

    docker exec -it wedding-prod-backend python -m scripts.bootstrap_prod \
        --couple-names "Ashley & Hazel" --date 2027-06-19 \
        --ceremony-time 14:00 \
        --ceremony-location "The Chapel" \
        --reception-location "The Grapevine Estate, Hall B"

Idempotent: re-running does NOT duplicate the wedding or regenerate an existing
role's invite code. Newly generated codes are printed ONCE — record them
securely (e.g. your password manager). Guests cannot RSVP until you switch the
wedding phase to 'live' in Settings.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, time

from app.api.invites import generate_invite_code
from app.config import get_settings
from app.db.database import SessionLocal
from app.db.models import Invite, Wedding

WEDDING_ID = 1


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Bootstrap the production wedding + couple/coordinator invites."
    )
    p.add_argument("--couple-names", required=True, help='e.g. "Ashley & Hazel"')
    p.add_argument("--date", required=True, help="Wedding date, YYYY-MM-DD")
    p.add_argument("--ceremony-time", help="HH:MM (24h), optional")
    p.add_argument("--ceremony-location", help="optional")
    p.add_argument("--reception-location", help="optional")
    return p.parse_args(argv)


def _ensure_invite(session, role: str, household: str):
    """Create a unique invite code for a role if none exists yet. Returns the
    new code, or None if one already existed (secret not reprinted)."""
    existing = (
        session.query(Invite)
        .filter(Invite.wedding_id == WEDDING_ID, Invite.role == role)
        .first()
    )
    if existing:
        print(f"  - {role:11s}: invite already exists ({existing.code}) — left as-is")
        return None

    code = generate_invite_code()
    while session.query(Invite).filter(Invite.code == code).first():
        code = generate_invite_code()
    session.add(
        Invite(code=code, wedding_id=WEDDING_ID, role=role, household_name=household)
    )
    session.commit()
    print(f"  - {role:11s}: created invite  ->  {code}")
    return code


def main(argv=None) -> int:
    args = parse_args(argv)
    try:
        wedding_date = date.fromisoformat(args.date)
    except ValueError:
        print(f"Invalid --date '{args.date}' (expected YYYY-MM-DD)", file=sys.stderr)
        return 2

    ceremony_time = None
    if args.ceremony_time:
        try:
            hh, mm = args.ceremony_time.split(":")
            ceremony_time = time(int(hh), int(mm))
        except Exception:
            print(
                f"Invalid --ceremony-time '{args.ceremony_time}' (expected HH:MM)",
                file=sys.stderr,
            )
            return 2

    settings = get_settings()
    print("=" * 70)
    print("PRODUCTION BOOTSTRAP")
    print(f"  Database:    {settings.masked_database_location()}")
    print(f"  Environment: {settings.environment}")
    print("=" * 70)

    session = SessionLocal()
    try:
        wedding = session.query(Wedding).filter(Wedding.id == WEDDING_ID).first()
        if wedding:
            print(
                f"Wedding already exists: {wedding.couple_names} "
                f"(phase={wedding.phase}) — not recreated."
            )
        else:
            wedding = Wedding(
                id=WEDDING_ID,
                couple_names=args.couple_names,
                wedding_date=wedding_date,
                ceremony_time=ceremony_time,
                ceremony_location=args.ceremony_location,
                reception_location=args.reception_location,
                phase="planning",
            )
            session.add(wedding)
            session.commit()
            print(
                f"Created wedding: {args.couple_names} on {wedding_date} "
                f"(phase=planning)."
            )

        print("\nInvite codes:")
        new_codes = [
            _ensure_invite(session, "couple", args.couple_names),
            _ensure_invite(session, "coordinator", "Wedding Coordinator"),
        ]

        print(
            "\nDone. Guests cannot RSVP until you set the wedding phase to 'live' "
            "in Settings."
        )
        if any(new_codes):
            print("Record the NEW codes above securely now — they are shown only once.")
        return 0
    except Exception as exc:  # noqa: BLE001 - surface any bootstrap failure
        session.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
