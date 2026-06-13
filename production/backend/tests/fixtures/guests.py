from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from uuid import uuid4


TEST_EMAIL_PREFIX = "pytest-guest"
TEST_WEDDING_ID = 1


def unique_guest_email(label: str = "guest") -> str:
    return f"{TEST_EMAIL_PREFIX}-{label}-{uuid4().hex}@example.com"


def guest_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "wedding_id": TEST_WEDDING_ID,
        "name": "Pytest Guest",
        "email": unique_guest_email(),
        "phone": "555-0199",
        "relationship": "test",
        "rsvp_status": "pending",
        "meal_choice": None,
        "dietary_notes": None,
    }
    payload.update(overrides)
    return payload


def guest_batch(count: int = 3) -> list[dict[str, object]]:
    statuses = ["pending", "accepted", "declined", "tentative"]
    return [
        guest_payload(
            name=f"Pytest Guest {index + 1}",
            email=unique_guest_email(f"batch-{index + 1}"),
            rsvp_status=statuses[index % len(statuses)],
        )
        for index in range(count)
    ]


def vendor_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "wedding_id": TEST_WEDDING_ID,
        "name": "Pytest Catering",
        "category": "catering",
        "contact_name": "Vendor Contact",
        "email": f"vendor-{uuid4().hex}@example.com",
        "phone": "555-0120",
        "estimated_cost": 2500,
    }
    payload.update(overrides)
    return payload


def budget_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "wedding_id": TEST_WEDDING_ID,
        "category": "catering",
        "description": "Pytest budget item",
        "estimated_amount": 2500,
        "actual_amount": 0,
        "paid": False,
    }
    payload.update(overrides)
    return payload


def copy_payload(payload: Mapping[str, object], **overrides: object) -> dict[str, object]:
    copied = deepcopy(dict(payload))
    copied.update(overrides)
    return copied
