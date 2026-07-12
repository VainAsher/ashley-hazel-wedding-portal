from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Wedding
from tests.fixtures.guests import TEST_WEDDING_ID


@pytest.fixture()
def restore_wedding(db_session: Session) -> Iterator[None]:
    """Snapshot the shared seed wedding and restore it after the test so other
    tests are unaffected by mutations made through the settings API."""
    wedding = db_session.get(Wedding, TEST_WEDDING_ID)
    assert wedding is not None
    original = {
        "couple_names": wedding.couple_names,
        "wedding_date": wedding.wedding_date,
        "ceremony_time": wedding.ceremony_time,
        "ceremony_location": wedding.ceremony_location,
        "reception_location": wedding.reception_location,
        "theme": wedding.theme,
        "party_visibility_mode": wedding.party_visibility_mode,
    }
    try:
        yield
    finally:
        db_session.expire_all()
        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        if wedding is not None:
            for field, value in original.items():
                setattr(wedding, field, value)
            db_session.commit()


class TestWeddingSettings:
    def test_get_returns_seeded_wedding(
        self,
        coordinator_session: TestClient,
        db_session: Session,
    ) -> None:
        response = coordinator_session.get("/api/settings/wedding")
        assert response.status_code == 200
        data = response.json()

        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        assert wedding is not None
        assert data["id"] == TEST_WEDDING_ID
        assert data["couple_names"] == wedding.couple_names
        assert data["wedding_date"] == wedding.wedding_date.isoformat()
        # Response shape only exposes editable settings fields.
        assert set(data.keys()) == {
            "id",
            "couple_names",
            "wedding_date",
            "ceremony_time",
            "ceremony_location",
            "reception_location",
            "phase",
            "theme",
            "meal_selection_open",
            "party_visibility_mode",
        }

    def test_put_updates_and_persists(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        restore_wedding: None,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"ceremony_location": "The Pytest Chapel"},
        )
        assert response.status_code == 200
        assert response.json()["ceremony_location"] == "The Pytest Chapel"
        # The update only ever targets the current user's wedding.
        assert response.json()["id"] == TEST_WEDDING_ID

        db_session.expire_all()
        persisted = db_session.get(Wedding, TEST_WEDDING_ID)
        assert persisted is not None
        assert persisted.ceremony_location == "The Pytest Chapel"

    def test_put_partial_update_leaves_other_fields(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        restore_wedding: None,
    ) -> None:
        before = coordinator_session.get("/api/settings/wedding").json()

        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"reception_location": "Pytest Reception Hall"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["reception_location"] == "Pytest Reception Hall"
        # Untouched fields are unchanged by the partial update.
        assert data["couple_names"] == before["couple_names"]
        assert data["wedding_date"] == before["wedding_date"]

    def test_put_blank_couple_names_rejected(
        self,
        coordinator_session: TestClient,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"couple_names": "   "},
        )
        assert response.status_code == 422

    def test_get_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/settings/wedding").status_code == 401

    def test_put_requires_authentication(self, client: TestClient) -> None:
        response = client.put(
            "/api/settings/wedding",
            json={"couple_names": "Hackers"},
        )
        assert response.status_code == 401


DEFAULT_TYPOGRAPHY = {
    "display_font": "Georgia",
    "body_font": "Inter",
    "type_scale": 1.0,
}


class TestWeddingTheme:
    def test_theme_round_trip(
        self,
        coordinator_session: TestClient,
        client: TestClient,
        restore_wedding: None,
    ) -> None:
        theme = {"primary": "#AA5500", "secondary": "#112233", "tint_opacity": 0.75}
        response = coordinator_session.put("/api/settings/wedding", json={"theme": theme})
        assert response.status_code == 200
        # Unset typography dials come back as the canonical defaults.
        assert response.json()["theme"] == {**theme, **DEFAULT_TYPOGRAPHY}

        # Guests (and the pre-login invite page) read it from the public endpoint.
        public = client.get("/api/portal/theme")
        assert public.status_code == 200
        assert public.json()["theme"] == {**theme, **DEFAULT_TYPOGRAPHY}

    def test_theme_reset_with_null(
        self,
        coordinator_session: TestClient,
        client: TestClient,
        restore_wedding: None,
    ) -> None:
        coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"primary": "#AA5500", "secondary": "#112233", "tint_opacity": 0.8}},
        )
        response = coordinator_session.put("/api/settings/wedding", json={"theme": None})
        assert response.status_code == 200
        assert response.json()["theme"] is None
        assert client.get("/api/portal/theme").json()["theme"] is None

    def test_theme_rejects_invalid_hex(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"primary": "not-a-colour"}},
        )
        assert response.status_code == 422

    def test_theme_rejects_out_of_range_opacity(
        self, coordinator_session: TestClient
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"tint_opacity": 0.1}},
        )
        assert response.status_code == 422

    def test_public_theme_needs_no_auth(self, client: TestClient) -> None:
        assert client.get("/api/portal/theme").status_code == 200


class TestWeddingTypography:
    def test_fonts_and_scale_round_trip(
        self,
        coordinator_session: TestClient,
        client: TestClient,
        db_session: Session,
        restore_wedding: None,
    ) -> None:
        theme = {
            "primary": "#AA5500",
            "secondary": "#112233",
            "tint_opacity": 0.75,
            "display_font": "Playfair Display",
            "body_font": "Nunito Sans",
            "type_scale": 1.1,
        }
        response = coordinator_session.put("/api/settings/wedding", json={"theme": theme})
        assert response.status_code == 200
        assert response.json()["theme"] == theme

        # Persisted in the wedding's JSONB theme column.
        db_session.expire_all()
        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        assert wedding is not None
        assert wedding.theme["display_font"] == "Playfair Display"
        assert wedding.theme["body_font"] == "Nunito Sans"
        assert wedding.theme["type_scale"] == 1.1

        # The public theme endpoint carries the typography keys too.
        public = client.get("/api/portal/theme")
        assert public.status_code == 200
        assert public.json()["theme"] == theme

    @pytest.mark.parametrize(
        "display_font",
        ["Comic Sans MS", "georgia", "Playfair Display; DROP TABLE", ""],
    )
    def test_rejects_unknown_display_font(
        self, coordinator_session: TestClient, display_font: str
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"display_font": display_font}},
        )
        assert response.status_code == 422

    @pytest.mark.parametrize("body_font", ["Papyrus", "inter", "Georgia", ""])
    def test_rejects_unknown_body_font(
        self, coordinator_session: TestClient, body_font: str
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"body_font": body_font}},
        )
        assert response.status_code == 422

    @pytest.mark.parametrize("type_scale", [0.5, 0.95, 1.2, 2, "big"])
    def test_rejects_unknown_type_scale(
        self, coordinator_session: TestClient, type_scale: object
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"type_scale": type_scale}},
        )
        assert response.status_code == 422

    def test_defaults_returned_when_unset(
        self,
        coordinator_session: TestClient,
        restore_wedding: None,
    ) -> None:
        # A colour-only theme (e.g. saved before the typography dials shipped)
        # still reports the default fonts and scale.
        coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"primary": "#AA5500", "secondary": "#112233"}},
        )
        theme = coordinator_session.get("/api/settings/wedding").json()["theme"]
        assert theme["display_font"] == "Georgia"
        assert theme["body_font"] == "Inter"
        assert theme["type_scale"] == 1.0


class TestPartyVisibilityMode:
    """Wave 3 item 14 D1: the "Party visibility" dial in admin Settings."""

    def test_defaults_to_partner_visible(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        restore_wedding: None,
    ) -> None:
        db_session.expire_all()
        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        assert wedding is not None
        wedding.party_visibility_mode = "partner_visible"
        db_session.commit()

        response = coordinator_session.get("/api/settings/wedding")
        assert response.json()["party_visibility_mode"] == "partner_visible"

    def test_put_updates_and_persists(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        restore_wedding: None,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding", json={"party_visibility_mode": "locked"}
        )
        assert response.status_code == 200
        assert response.json()["party_visibility_mode"] == "locked"

        db_session.expire_all()
        persisted = db_session.get(Wedding, TEST_WEDDING_ID)
        assert persisted is not None
        assert persisted.party_visibility_mode == "locked"

    def test_rejects_unknown_mode(
        self, coordinator_session: TestClient, restore_wedding: None
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding", json={"party_visibility_mode": "wide_open"}
        )
        assert response.status_code == 422

    def test_partial_update_leaves_mode_unchanged(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        restore_wedding: None,
    ) -> None:
        coordinator_session.put(
            "/api/settings/wedding", json={"party_visibility_mode": "locked"}
        )
        response = coordinator_session.put(
            "/api/settings/wedding", json={"ceremony_location": "The Pytest Chapel"}
        )
        assert response.status_code == 200
        assert response.json()["party_visibility_mode"] == "locked"
