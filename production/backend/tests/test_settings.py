from __future__ import annotations

import io
import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.db.models import Wedding
from tests.fixtures.guests import TEST_WEDDING_ID


def make_image_bytes(size: tuple[int, int] = (200, 200)) -> bytes:
    image = Image.new("RGB", size, "#7a3b69")
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


@pytest.fixture()
def uploads_dir(tmp_path: Path) -> Iterator[Path]:
    """Point UPLOADS_DIR at a temp dir so the repo isn't polluted."""
    previous = os.environ.get("UPLOADS_DIR")
    target = tmp_path / "uploads"
    target.mkdir(parents=True, exist_ok=True)
    os.environ["UPLOADS_DIR"] = str(target)
    try:
        yield target
    finally:
        if previous is None:
            os.environ.pop("UPLOADS_DIR", None)
        else:
            os.environ["UPLOADS_DIR"] = previous


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
    "layout_mode": "paged",
    "page_backgrounds": {},
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
            "layout_mode": "scroll",
            "page_backgrounds": {},
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
        assert wedding.theme["layout_mode"] == "scroll"

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
        assert theme["layout_mode"] == "paged"


class TestWeddingLayoutMode:
    """Wave 4 item 17 Phase 1 (docs/specs/VIEWPORT_PAGING_PHASE1.md): the
    guest-site paged/scroll navigation dial, nested in the theme JSONB
    exactly like display_font/type_scale."""

    def test_defaults_to_paged_when_unset(
        self,
        coordinator_session: TestClient,
        restore_wedding: None,
    ) -> None:
        # A theme saved without layout_mode (e.g. colour-only) still reports
        # the canonical default -- same "older stored theme" case the other
        # typography dials already handle.
        coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"primary": "#AA5500", "secondary": "#112233"}},
        )
        theme = coordinator_session.get("/api/settings/wedding").json()["theme"]
        assert theme["layout_mode"] == "paged"

    @pytest.mark.parametrize("layout_mode", ["paged", "scroll"])
    def test_layout_mode_round_trip(
        self,
        coordinator_session: TestClient,
        client: TestClient,
        db_session: Session,
        restore_wedding: None,
        layout_mode: str,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"layout_mode": layout_mode}},
        )
        assert response.status_code == 200
        assert response.json()["theme"]["layout_mode"] == layout_mode

        # Persisted in the wedding's JSONB theme column.
        db_session.expire_all()
        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        assert wedding is not None
        assert wedding.theme["layout_mode"] == layout_mode

        # The public (unauthenticated) theme endpoint round-trips it too --
        # this is the endpoint GuestLayout's usePortalTheme() actually reads.
        public = client.get("/api/portal/theme")
        assert public.status_code == 200
        assert public.json()["theme"]["layout_mode"] == layout_mode

    @pytest.mark.parametrize(
        "layout_mode",
        ["grid", "Paged", "SCROLL", "paged ", "", "paged; DROP TABLE", 123, None],
    )
    def test_rejects_unknown_layout_mode(
        self,
        coordinator_session: TestClient,
        layout_mode: object,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"layout_mode": layout_mode}},
        )
        assert response.status_code == 422


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


VALID_PAGE_BACKGROUND = {
    "source": "stock",
    "url": "/backgrounds/bg-03-waterfall.jpg",
    "focal_x": 32.4,
    "focal_y": 68.1,
    "zoom": 1.6,
}


class TestPageBackgrounds:
    """ROADMAP item 18 (docs/specs/PAGE_BACKGROUNDS.md): per-page background
    photo + focal point/zoom, nested in the theme JSONB exactly like
    layout_mode -- see TestWeddingLayoutMode above for the precedent."""

    def test_defaults_to_empty_when_unset(
        self,
        coordinator_session: TestClient,
        restore_wedding: None,
    ) -> None:
        coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"primary": "#AA5500"}},
        )
        theme = coordinator_session.get("/api/settings/wedding").json()["theme"]
        assert theme["page_backgrounds"] == {}

    def test_round_trip_through_settings_and_public_theme(
        self,
        coordinator_session: TestClient,
        client: TestClient,
        db_session: Session,
        restore_wedding: None,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"page_backgrounds": {"dashboard": VALID_PAGE_BACKGROUND}}},
        )
        assert response.status_code == 200
        assert response.json()["theme"]["page_backgrounds"]["dashboard"] == VALID_PAGE_BACKGROUND

        db_session.expire_all()
        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        assert wedding is not None
        assert wedding.theme["page_backgrounds"]["dashboard"] == VALID_PAGE_BACKGROUND

        # The public (unauthenticated) theme endpoint -- what GuestLayout's
        # usePortalTheme() and AuthLayout actually read -- round-trips it too.
        public = client.get("/api/portal/theme")
        assert public.status_code == 200
        assert public.json()["theme"]["page_backgrounds"]["dashboard"] == VALID_PAGE_BACKGROUND

    def test_rejects_unknown_page_key(
        self, coordinator_session: TestClient, restore_wedding: None
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"page_backgrounds": {"music": VALID_PAGE_BACKGROUND}}},
        )
        assert response.status_code == 422

    def test_rejects_unknown_source(
        self, coordinator_session: TestClient, restore_wedding: None
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={
                "theme": {
                    "page_backgrounds": {
                        "dashboard": {**VALID_PAGE_BACKGROUND, "source": "instagram"}
                    }
                }
            },
        )
        assert response.status_code == 422

    @pytest.mark.parametrize("field,value", [("focal_x", -1), ("focal_x", 101), ("focal_y", -1), ("focal_y", 101)])
    def test_rejects_out_of_range_focal_point(
        self,
        coordinator_session: TestClient,
        restore_wedding: None,
        field: str,
        value: float,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"page_backgrounds": {"dashboard": {**VALID_PAGE_BACKGROUND, field: value}}}},
        )
        assert response.status_code == 422

    @pytest.mark.parametrize("zoom", [0.5, 2.6])
    def test_rejects_out_of_range_zoom(
        self,
        coordinator_session: TestClient,
        restore_wedding: None,
        zoom: float,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"theme": {"page_backgrounds": {"dashboard": {**VALID_PAGE_BACKGROUND, "zoom": zoom}}}},
        )
        assert response.status_code == 422

    def test_rejects_stock_url_not_in_shipped_list(
        self, coordinator_session: TestClient, restore_wedding: None
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={
                "theme": {
                    "page_backgrounds": {
                        "dashboard": {**VALID_PAGE_BACKGROUND, "url": "/backgrounds/not-a-real-file.jpg"}
                    }
                }
            },
        )
        assert response.status_code == 422

    def test_rejects_gallery_source_url_outside_uploads(
        self, coordinator_session: TestClient, restore_wedding: None
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={
                "theme": {
                    "page_backgrounds": {
                        "dashboard": {
                            "source": "gallery",
                            "url": "/backgrounds/bg-01-winter-selfie.jpg",
                            "focal_x": 50,
                            "focal_y": 50,
                            "zoom": 1.0,
                        }
                    }
                }
            },
        )
        assert response.status_code == 422


class TestBackgroundUpload:
    """The no-moderation, no-thumbnail upload endpoint backing the page
    background picker's "Upload" tab -- see upload_my_profile_photo in
    app/api/profiles.py for the pattern this mirrors."""

    def test_rejects_non_image_upload(
        self, coordinator_session: TestClient, uploads_dir: Path
    ) -> None:
        response = coordinator_session.post(
            "/api/settings/backgrounds/upload",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
        assert response.status_code == 400

    def test_rejects_file_over_size_limit(
        self, coordinator_session: TestClient, uploads_dir: Path
    ) -> None:
        oversized = b"\x00" * (15 * 1024 * 1024 + 1)
        response = coordinator_session.post(
            "/api/settings/backgrounds/upload",
            files={"file": ("huge.png", oversized, "image/png")},
        )
        assert response.status_code == 413

    def test_accepts_image_and_stores_under_backgrounds_subfolder(
        self, coordinator_session: TestClient, uploads_dir: Path
    ) -> None:
        response = coordinator_session.post(
            "/api/settings/backgrounds/upload",
            files={"file": ("dashboard.png", make_image_bytes(), "image/png")},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["url"].startswith(f"/uploads/{TEST_WEDDING_ID}/backgrounds/")

        relative_path = body["url"].removeprefix("/uploads/")
        assert (uploads_dir / relative_path).is_file()

    def test_requires_coordinator(
        self, guest_session: TestClient, uploads_dir: Path
    ) -> None:
        response = guest_session.post(
            "/api/settings/backgrounds/upload",
            files={"file": ("dashboard.png", make_image_bytes(), "image/png")},
        )
        assert response.status_code == 403

    def test_requires_authentication(self, client: TestClient, uploads_dir: Path) -> None:
        response = client.post(
            "/api/settings/backgrounds/upload",
            files={"file": ("dashboard.png", make_image_bytes(), "image/png")},
        )
        assert response.status_code == 401
