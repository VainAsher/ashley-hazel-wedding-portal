from __future__ import annotations

from datetime import datetime

from app.db.models import Guest, RsvpStatus
from app.db.schemas import GuestCreate, GuestResponse, GuestUpdate


def test_guest_model_accepts_rsvp_detail_fields() -> None:
    guest = Guest(
        wedding_id=1,
        name="RSVP Guest",
        meal_choice="vegetarian",
        dietary_notes="No nuts",
    )

    assert guest.meal_choice == "vegetarian"
    assert guest.dietary_notes == "No nuts"


def test_guest_create_schema_accepts_rsvp_detail_fields() -> None:
    payload = GuestCreate(
        wedding_id=1,
        name="RSVP Guest",
        meal_choice="chicken",
        dietary_notes="No shellfish",
    )

    assert payload.meal_choice == "chicken"
    assert payload.dietary_notes == "No shellfish"
    assert payload.rsvp_status == RsvpStatus.pending


def test_guest_update_schema_keeps_rsvp_detail_fields_optional() -> None:
    payload = GuestUpdate()

    assert payload.meal_choice is None
    assert payload.dietary_notes is None


def test_guest_response_schema_includes_rsvp_detail_fields() -> None:
    now = datetime.now()
    guest = Guest(
        id=10,
        wedding_id=1,
        name="RSVP Guest",
        rsvp_status=RsvpStatus.accepted,
        meal_choice="fish",
        dietary_notes="Dairy-free",
        created_at=now,
        updated_at=now,
    )

    response = GuestResponse.model_validate(guest)

    assert response.meal_choice == "fish"
    assert response.dietary_notes == "Dairy-free"
