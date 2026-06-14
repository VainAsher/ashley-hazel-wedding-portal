#!/usr/bin/env python3
"""Seed test data for the wedding portal."""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "production/backend"))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.db.models import Wedding, Guest, Invite

# Database URL - adjust this as needed
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://user:password@192.168.0.32:5432/wedding"
)

def seed_demo_data():
    """Create demo data for testing."""
    engine = create_engine(DATABASE_URL)

    with Session(engine) as session:
        # Check if demo wedding exists
        wedding = session.query(Wedding).filter(Wedding.couple_first_name == "Demo").first()
        if not wedding:
            wedding = Wedding(
                couple_first_name="Demo",
                couple_last_name="Wedding",
                wedding_date="2025-06-15",
                venue_name="Demo Venue"
            )
            session.add(wedding)
            session.commit()
            print(f"Created demo wedding (id={wedding.id})")
        else:
            print(f"Demo wedding already exists (id={wedding.id})")

        # Check if demo guest exists
        guest = session.query(Guest).filter(
            Guest.name == "Demo Guest",
            Guest.wedding_id == wedding.id
        ).first()
        if not guest:
            guest = Guest(
                wedding_id=wedding.id,
                name="Demo Guest",
                email="demo@example.com",
                relationship="friend"
            )
            session.add(guest)
            session.commit()
            print(f"Created demo guest (id={guest.id})")
        else:
            print(f"Demo guest already exists (id={guest.id})")

        # Check if DEMO_001 invite exists
        invite = session.query(Invite).filter(Invite.code == "DEMO_001").first()
        if not invite:
            invite = Invite(
                code="DEMO_001",
                wedding_id=wedding.id,
                guest_id=guest.id,
                household_name="Demo Household",
                role="guest"
            )
            session.add(invite)
            session.commit()
            print(f"Created DEMO_001 invite (id={invite.id}, guest_id={guest.id})")
        else:
            print(f"DEMO_001 invite already exists (id={invite.id})")
            if invite.guest_id:
                print(f"  - Linked to guest {invite.guest_id}")
            else:
                print(f"  - Not linked to a guest")

        print("\nSeed data created successfully!")

if __name__ == "__main__":
    try:
        seed_demo_data()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
