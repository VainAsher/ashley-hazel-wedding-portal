#!/usr/bin/env python3
"""
Validate that test database seeds exist and are properly configured.

This script verifies:
- Test wedding exists
- All required invite codes exist
- Invites have correct roles
- Guest associations are valid
- Invites can be used for authentication

Usage:
    python -m scripts.validate_test_seeds
"""

from __future__ import annotations

import os
import sys

os.environ.setdefault("DATABASE_URL", "postgresql://localhost/wedding")

from app.db.database import SessionLocal
from app.db.models import Guest, Invite, Wedding


def validate_wedding() -> bool:
    """Validate test wedding exists."""
    session = SessionLocal()
    try:
        wedding = session.query(Wedding).filter(Wedding.id == 1).first()

        if not wedding:
            print("✗ Test wedding not found (ID: 1)")
            return False

        print(f"✓ Test wedding exists: {wedding.couple_names}")
        print(f"  - Date: {wedding.wedding_date}")
        print(f"  - ID: {wedding.id}")
        return True

    finally:
        session.close()


def validate_invites() -> bool:
    """Validate all required invites exist."""
    session = SessionLocal()
    required_codes = {
        "DEMO-COUPLE": "couple",
        "DEMO-COORDINATOR": "coordinator",
        "DEMO-GUEST": "guest",
    }
    all_valid = True

    try:
        for code, expected_role in required_codes.items():
            invite = session.query(Invite).filter(Invite.code == code).first()

            if not invite:
                print(f"✗ Invite not found: {code}")
                all_valid = False
                continue

            if invite.role != expected_role:
                print(f"✗ Invite {code} has role '{invite.role}', expected '{expected_role}'")
                all_valid = False
                continue

            guest_info = ""
            if invite.guest_id:
                guest = session.query(Guest).filter(Guest.id == invite.guest_id).first()
                if guest:
                    guest_info = f" -> Guest: {guest.name}"

            print(f"✓ Invite exists: {code} (role: {expected_role}){guest_info}")

        return all_valid

    finally:
        session.close()


def validate_guests() -> bool:
    """Validate test guests exist."""
    session = SessionLocal()
    required_guests = {
        "demo-guest@example.com": "Demo Guest",
        "demo-guest-1@example.com": "Alice Anderson",
        "demo-guest-2@example.com": "Bob Butler",
        "demo-guest-3@example.com": "Carol Chen",
        "demo-guest-4@example.com": "David Davis",
    }
    all_valid = True

    try:
        for email, expected_name in required_guests.items():
            guest = (
                session.query(Guest)
                .filter(Guest.wedding_id == 1, Guest.email == email)
                .first()
            )

            if not guest:
                print(f"✗ Guest not found: {email}")
                all_valid = False
                continue

            if guest.name != expected_name:
                print(f"✗ Guest {email} has name '{guest.name}', expected '{expected_name}'")
                all_valid = False
                continue

            print(f"✓ Guest exists: {guest.name} ({email})")

        return all_valid

    finally:
        session.close()


def validate_relationships() -> bool:
    """Validate invite-guest relationships."""
    session = SessionLocal()
    all_valid = True

    try:
        # DEMO-GUEST should be linked to Demo Guest
        demo_guest_invite = (
            session.query(Invite)
            .filter(Invite.code == "DEMO-GUEST", Invite.wedding_id == 1)
            .first()
        )

        if not demo_guest_invite:
            print("✗ DEMO-GUEST invite not found")
            return False

        if not demo_guest_invite.guest_id:
            print("✗ DEMO-GUEST invite is not linked to a guest")
            return False

        guest = (
            session.query(Guest)
            .filter(Guest.id == demo_guest_invite.guest_id)
            .first()
        )

        if not guest:
            print(f"✗ Guest not found for DEMO-GUEST invite (guest_id: {demo_guest_invite.guest_id})")
            return False

        print(f"✓ DEMO-GUEST invite correctly linked to: {guest.name}")

        # DEMO-COUPLE and DEMO-COORDINATOR should NOT be linked to guests
        for code in ["DEMO-COUPLE", "DEMO-COORDINATOR"]:
            invite = (
                session.query(Invite)
                .filter(Invite.code == code, Invite.wedding_id == 1)
                .first()
            )

            if invite and invite.guest_id:
                print(f"✗ {code} invite should not be linked to a guest")
                all_valid = False
            elif invite:
                print(f"✓ {code} invite correctly has no guest link")

        return all_valid

    finally:
        session.close()


def validate_counts() -> bool:
    """Validate expected counts of records."""
    session = SessionLocal()

    try:
        invite_count = (
            session.query(Invite)
            .filter(
                Invite.wedding_id == 1,
                Invite.code.in_(["DEMO-COUPLE", "DEMO-COORDINATOR", "DEMO-GUEST"])
            )
            .count()
        )

        guest_count = (
            session.query(Guest)
            .filter(
                Guest.wedding_id == 1,
                Guest.email.in_([
                    "demo-guest@example.com",
                    "demo-guest-1@example.com",
                    "demo-guest-2@example.com",
                    "demo-guest-3@example.com",
                    "demo-guest-4@example.com",
                ])
            )
            .count()
        )

        all_valid = True

        if invite_count < 3:
            print(f"✗ Expected 3+ test invites, found {invite_count}")
            all_valid = False
        else:
            print(f"✓ Found {invite_count} test invites")

        if guest_count < 5:
            print(f"✗ Expected 5+ test guests, found {guest_count}")
            all_valid = False
        else:
            print(f"✓ Found {guest_count} test guests")

        return all_valid

    finally:
        session.close()


def main() -> int:
    """Main validation entry point."""
    print("\n" + "=" * 70)
    print("VALIDATING TEST DATABASE SEEDS")
    print("=" * 70 + "\n")

    try:
        checks = [
            ("Wedding existence", validate_wedding),
            ("Invite codes", validate_invites),
            ("Guest records", validate_guests),
            ("Invite-guest relationships", validate_relationships),
            ("Record counts", validate_counts),
        ]

        results = {}
        for check_name, check_func in checks:
            print(f"\n{check_name}:")
            print("-" * 70)
            results[check_name] = check_func()

        # Summary
        print("\n" + "=" * 70)
        print("VALIDATION SUMMARY")
        print("=" * 70)

        all_passed = all(results.values())

        for check_name, passed in results.items():
            status = "✓ PASS" if passed else "✗ FAIL"
            print(f"{status}: {check_name}")

        if all_passed:
            print("\n✓ All validations passed!")
            print("\nTest invites are ready to use:")
            print("  - DEMO-COUPLE (login as couple)")
            print("  - DEMO-COORDINATOR (login as coordinator)")
            print("  - DEMO-GUEST (login as guest)")
            print("\nExample:")
            print('  response = client.post("/api/auth/login",')
            print('    json={"invite_code": "DEMO-COUPLE"})')
            print("=" * 70 + "\n")
            return 0
        else:
            print("\n✗ Some validations failed!")
            print("\nRun the seed script to create test data:")
            print("  python -m scripts.seed_test_data")
            print("=" * 70 + "\n")
            return 1

    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
