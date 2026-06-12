from __future__ import annotations

from app.db.models import Guest


def test_sample_data_fixtures_are_distinct(
    sample_guest_payload: dict[str, object],
    sample_vendor_payload: dict[str, object],
    sample_budget_payload: dict[str, object],
    wedding_id: int,
) -> None:
    assert sample_guest_payload["wedding_id"] == wedding_id
    assert sample_vendor_payload["wedding_id"] == wedding_id
    assert sample_budget_payload["wedding_id"] == wedding_id
    assert sample_guest_payload["email"] != sample_vendor_payload["email"]
    assert sample_budget_payload["category"] == "catering"


def test_sample_guest_fixture_persists_guest(sample_guest: Guest, wedding_id: int) -> None:
    assert sample_guest.id > 0
    assert sample_guest.wedding_id == wedding_id
    assert sample_guest.email is not None
    assert sample_guest.email.startswith("pytest-guest-")


def test_multiple_guests_fixture_persists_varied_guests(
    multiple_guests: list[Guest],
) -> None:
    assert len(multiple_guests) == 3
    statuses = {
        getattr(guest.rsvp_status, "value", guest.rsvp_status)
        for guest in multiple_guests
    }
    assert statuses == {
        "pending",
        "accepted",
        "declined",
    }
    assert len({guest.email for guest in multiple_guests}) == 3
