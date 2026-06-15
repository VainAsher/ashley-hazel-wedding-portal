#!/usr/bin/env python3
"""
Seed test database with valid invites and guests for authentication testing.

This script creates:
- Test couples with invite codes (DEMO-COUPLE)
- Test coordinators with invite codes (DEMO-COORDINATOR)
- Test guests with invite codes (DEMO-GUEST)
- Associated guest records linked to invites

The script is idempotent - it can be run multiple times safely.

Usage:
    python -m scripts.seed_test_data

Environment:
    DATABASE_URL: PostgreSQL connection string (defaults to postgresql://localhost/wedding)
"""

from __future__ import annotations

import os
import sys
from datetime import date, datetime
from uuid import uuid4

# Set default database URL for test database
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/wedding")

from sqlalchemy.exc import IntegrityError

from app.db.database import SessionLocal
from app.db.models import Guest, Invite, Wedding


# Test data constants
TEST_WEDDING_ID = 1
TEST_WEDDING_NAME = "Ashley & Hazel"
TEST_WEDDING_DATE = date(2026, 6, 20)

# Invite codes for testing
INVITE_CODES = {
    "couple": "DEMO-COUPLE",
    "coordinator": "DEMO-COORDINATOR",
    "guest": "DEMO-GUEST",
}


def ensure_test_wedding(session) -> int:
    """
    Ensure test wedding exists. Creates it if not found.
    Returns the wedding ID.
    """
    wedding = session.query(Wedding).filter(Wedding.id == TEST_WEDDING_ID).first()

    if wedding:
        print(f"✓ Test wedding already exists: {wedding.couple_names} (ID: {wedding.id})")
        return wedding.id

    print(f"Creating test wedding: {TEST_WEDDING_NAME} ({TEST_WEDDING_DATE})")
    wedding = Wedding(
        id=TEST_WEDDING_ID,
        couple_names=TEST_WEDDING_NAME,
        wedding_date=TEST_WEDDING_DATE,
    )
    session.add(wedding)
    session.commit()
    session.refresh(wedding)
    print(f"✓ Test wedding created: {wedding.couple_names} (ID: {wedding.id})")
    return wedding.id


def seed_couple_invite(session, wedding_id: int) -> bool:
    """
    Seed a couple invite code. Returns True if created, False if already exists.
    """
    code = INVITE_CODES["couple"]
    existing = session.query(Invite).filter(Invite.code == code).first()

    if existing:
        print(f"✓ Couple invite already exists: {code}")
        return False

    print(f"Creating couple invite: {code}")
    invite = Invite(
        code=code,
        wedding_id=wedding_id,
        household_name="Demo Couple",
        role="couple",
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)
    print(f"✓ Couple invite created: {code}")
    return True


def seed_coordinator_invite(session, wedding_id: int) -> bool:
    """
    Seed a coordinator invite code. Returns True if created, False if already exists.
    """
    code = INVITE_CODES["coordinator"]
    existing = session.query(Invite).filter(Invite.code == code).first()

    if existing:
        print(f"✓ Coordinator invite already exists: {code}")
        return False

    print(f"Creating coordinator invite: {code}")
    invite = Invite(
        code=code,
        wedding_id=wedding_id,
        household_name="Demo Coordinator",
        role="coordinator",
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)
    print(f"✓ Coordinator invite created: {code}")
    return True


def seed_guest_invite(session, wedding_id: int) -> bool:
    """
    Seed a guest invite code with associated guest record.
    Returns True if created, False if already exists.
    """
    code = INVITE_CODES["guest"]
    existing_invite = session.query(Invite).filter(Invite.code == code).first()

    if existing_invite:
        print(f"✓ Guest invite already exists: {code}")
        return False

    # Create guest record first (optional but useful for full testing)
    print(f"Creating guest record for: {code}")
    guest = Guest(
        wedding_id=wedding_id,
        name="Demo Guest",
        email="demo-guest@example.com",
        phone="555-0100",
        relationship="friend",
        rsvp_status="pending",
    )

    try:
        session.add(guest)
        session.commit()
        session.refresh(guest)
        guest_id = guest.id
        print(f"✓ Guest record created: {guest.name} (ID: {guest_id})")
    except IntegrityError:
        # Guest email might already exist, find it
        session.rollback()
        guest = session.query(Guest).filter(
            Guest.wedding_id == wedding_id,
            Guest.email == "demo-guest@example.com"
        ).first()
        if guest:
            guest_id = guest.id
            print(f"✓ Guest record already exists: {guest.name} (ID: {guest_id})")
        else:
            raise

    # Create invite linked to guest
    print(f"Creating guest invite: {code}")
    invite = Invite(
        code=code,
        wedding_id=wedding_id,
        guest_id=guest_id,
        household_name="Demo Guest Household",
        role="guest",
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)
    print(f"✓ Guest invite created: {code} -> Guest ID {guest_id}")
    return True


def seed_additional_guests(session, wedding_id: int) -> None:
    """
    Seed additional test guests (without invites) for guest list testing.
    """
    guest_names = [
        "Alice Anderson",
        "Bob Butler",
        "Carol Chen",
        "David Davis",
    ]

    for i, name in enumerate(guest_names):
        email = f"demo-guest-{i+1}@example.com"
        existing = session.query(Guest).filter(
            Guest.wedding_id == wedding_id,
            Guest.email == email
        ).first()

        if existing:
            print(f"✓ Guest already exists: {name} ({email})")
            continue

        print(f"Creating additional guest: {name}")
        guest = Guest(
            wedding_id=wedding_id,
            name=name,
            email=email,
            phone=f"555-010{i}",
            relationship="friend",
            rsvp_status="pending",
        )
        session.add(guest)
        session.commit()
        session.refresh(guest)
        print(f"✓ Guest created: {name} (ID: {guest.id})")


def main() -> int:
    """Main entry point."""
    session = SessionLocal()

    try:
        print("\n" + "=" * 70)
        print("SEEDING TEST DATABASE WITH VALID INVITES AND GUESTS")
        print("=" * 70 + "\n")

        # Step 1: Ensure test wedding exists
        print("Step 1: Ensuring test wedding exists...")
        wedding_id = ensure_test_wedding(session)
        print()

        # Step 2: Seed invite codes
        print("Step 2: Seeding invite codes...")
        seed_couple_invite(session, wedding_id)
        seed_coordinator_invite(session, wedding_id)
        seed_guest_invite(session, wedding_id)
        print()

        # Step 3: Seed additional test guests
        print("Step 3: Seeding additional test guests...")
        seed_additional_guests(session, wedding_id)
        print()

        # Step 4: Summary
        print("Step 4: Verifying seeded data...")
        invites = session.query(Invite).filter(Invite.wedding_id == wedding_id).all()
        guests = session.query(Guest).filter(Guest.wedding_id == wedding_id).all()

        print(f"Total invites: {len(invites)}")
        for invite in invites:
            guest_info = f" (Guest: {invite.guest.name})" if invite.guest else ""
            print(f"  - {invite.code} ({invite.role}){guest_info}")

        print(f"\nTotal guests: {len(guests)}")
        for guest in guests:
            print(f"  - {guest.name} ({guest.email})")

        print("\n" + "=" * 70)
        print("✓ TEST DATABASE SEEDING COMPLETE")
        print("=" * 70)
        print("\nTest Invite Codes:")
        print(f"  Couple:      {INVITE_CODES['couple']}")
        print(f"  Coordinator: {INVITE_CODES['coordinator']}")
        print(f"  Guest:       {INVITE_CODES['guest']}")
        print("\nUse these codes in tests via:")
        print('  response = client.post("/api/auth/login", json={"invite_code": "DEMO-COUPLE"})')
        print("=" * 70 + "\n")

        return 0

    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
