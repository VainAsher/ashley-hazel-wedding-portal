from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Guest, Invite, MenuOption, Wedding
from tests.fixtures.guests import TEST_WEDDING_ID, unique_guest_email


TEST_OPTION_PREFIX = "Pytest Menu"
TEST_INVITE_PREFIX = "PYTEST-MENU"


@pytest.fixture(autouse=True)
def cleanup_menu_options(db_session: Session) -> Iterator[None]:
    def _purge() -> None:
        db_session.query(MenuOption).filter(
            MenuOption.name.like(f"{TEST_OPTION_PREFIX}%")
        ).delete(synchronize_session=False)
        db_session.commit()

    _purge()
    yield
    _purge()


@pytest.fixture()
def set_meal_selection(db_session: Session) -> Iterator[object]:
    """Snapshot the shared seed wedding's meal_selection_open and restore it."""
    wedding = db_session.get(Wedding, TEST_WEDDING_ID)
    assert wedding is not None
    original = wedding.meal_selection_open

    def _set(value: bool) -> None:
        db_session.expire_all()
        target = db_session.get(Wedding, TEST_WEDDING_ID)
        assert target is not None
        target.meal_selection_open = value
        db_session.commit()

    try:
        yield _set
    finally:
        db_session.expire_all()
        target = db_session.get(Wedding, TEST_WEDDING_ID)
        if target is not None:
            target.meal_selection_open = original
            db_session.commit()


def make_option(db_session: Session, **overrides: object) -> MenuOption:
    values: dict[str, object] = {
        "wedding_id": TEST_WEDDING_ID,
        "name": f"{TEST_OPTION_PREFIX} {uuid4().hex[:8]}",
        "active": True,
    }
    values.update(overrides)
    option = MenuOption(**values)
    db_session.add(option)
    db_session.commit()
    db_session.refresh(option)
    return option


def create_menu_guest(db_session: Session, name: str = "Menu RSVP Guest") -> Guest:
    guest = Guest(
        wedding_id=TEST_WEDDING_ID,
        name=name,
        email=unique_guest_email("menu"),
        relationship="test",
    )
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)
    return guest


def login_own_guest(client: TestClient, db_session: Session, name: str) -> Guest:
    """Create a guest with their own invite and sign the client in as them."""
    guest = create_menu_guest(db_session, name=name)
    invite = Invite(
        code=f"{TEST_INVITE_PREFIX}-{uuid4().hex[:8].upper()}",
        wedding_id=TEST_WEDDING_ID,
        guest_id=guest.id,
        household_name="Pytest Menu Household",
        role="guest",
    )
    db_session.add(invite)
    db_session.commit()
    response = client.post("/api/auth/login", json={"invite_code": invite.code})
    assert response.status_code == 200
    return guest


@pytest.fixture()
def clean_menu_invites(db_session: Session) -> Iterator[None]:
    def _purge() -> None:
        db_session.query(Invite).filter(
            Invite.code.like(f"{TEST_INVITE_PREFIX}-%")
        ).delete(synchronize_session=False)
        db_session.commit()

    _purge()
    yield
    _purge()


class TestCoordinatorCrud:
    def test_create_returns_option_with_defaults(
        self, coordinator_session: TestClient
    ) -> None:
        response = coordinator_session.post(
            "/api/menu",
            json={"name": f"{TEST_OPTION_PREFIX} Herb Chicken"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == f"{TEST_OPTION_PREFIX} Herb Chicken"
        assert data["wedding_id"] == TEST_WEDDING_ID
        assert data["description"] is None
        assert data["course"] is None
        assert data["is_vegetarian"] is False
        assert data["is_vegan"] is False
        assert data["is_gluten_free"] is False
        assert data["active"] is True

    def test_create_with_flags_and_course(
        self, coordinator_session: TestClient
    ) -> None:
        response = coordinator_session.post(
            "/api/menu",
            json={
                "name": f"{TEST_OPTION_PREFIX} Wild Mushroom Wellington",
                "description": "Roasted mushrooms in golden pastry",
                "course": "main",
                "is_vegetarian": True,
                "is_vegan": True,
                "is_gluten_free": False,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["description"] == "Roasted mushrooms in golden pastry"
        assert data["course"] == "main"
        assert data["is_vegetarian"] is True
        assert data["is_vegan"] is True

    def test_create_blank_name_rejected(
        self, coordinator_session: TestClient
    ) -> None:
        response = coordinator_session.post("/api/menu", json={"name": "   "})
        assert response.status_code == 422

    def test_create_invalid_course_rejected(
        self, coordinator_session: TestClient
    ) -> None:
        response = coordinator_session.post(
            "/api/menu",
            json={"name": f"{TEST_OPTION_PREFIX} Bad Course", "course": "amuse-bouche"},
        )
        assert response.status_code == 422

    def test_list_includes_inactive_options(
        self, coordinator_session: TestClient, db_session: Session
    ) -> None:
        active = make_option(db_session)
        inactive = make_option(db_session, active=False)

        response = coordinator_session.get("/api/menu")
        assert response.status_code == 200
        by_id = {item["id"]: item for item in response.json()}
        assert by_id[active.id]["active"] is True
        assert by_id[inactive.id]["active"] is False

    def test_patch_updates_fields(
        self, coordinator_session: TestClient, db_session: Session
    ) -> None:
        option = make_option(db_session)

        response = coordinator_session.patch(
            f"/api/menu/{option.id}",
            json={
                "name": f"{TEST_OPTION_PREFIX} Renamed",
                "description": "Now with description",
                "is_gluten_free": True,
                "active": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == f"{TEST_OPTION_PREFIX} Renamed"
        assert data["description"] == "Now with description"
        assert data["is_gluten_free"] is True
        assert data["active"] is False

        db_session.expire_all()
        persisted = db_session.get(MenuOption, option.id)
        assert persisted is not None
        assert persisted.active is False

    def test_delete_soft_deletes(
        self, coordinator_session: TestClient, db_session: Session
    ) -> None:
        option = make_option(db_session)

        response = coordinator_session.delete(f"/api/menu/{option.id}")
        assert response.status_code == 200
        assert response.json() == {"status": "deleted", "id": option.id}

        db_session.expire_all()
        persisted = db_session.get(MenuOption, option.id)
        assert persisted is not None  # row survives for meal-choice history
        assert persisted.active is False

    def test_patch_unknown_option_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.patch(
            "/api/menu/999999", json={"name": "Ghost"}
        )
        assert response.status_code == 404


class TestCrossWedding:
    @pytest.fixture()
    def other_wedding_option(self, db_session: Session) -> Iterator[MenuOption]:
        other_wedding = Wedding(
            couple_names="Pytest Menu Other Couple",
            wedding_date=date(2030, 6, 1),
        )
        db_session.add(other_wedding)
        db_session.commit()
        option = make_option(db_session, wedding_id=other_wedding.id)
        try:
            yield option
        finally:
            db_session.delete(option)
            db_session.delete(other_wedding)
            db_session.commit()

    def test_patch_other_weddings_option_is_404(
        self,
        coordinator_session: TestClient,
        other_wedding_option: MenuOption,
    ) -> None:
        response = coordinator_session.patch(
            f"/api/menu/{other_wedding_option.id}", json={"name": "Hijack"}
        )
        assert response.status_code == 404

    def test_delete_other_weddings_option_is_404(
        self,
        coordinator_session: TestClient,
        other_wedding_option: MenuOption,
    ) -> None:
        response = coordinator_session.delete(
            f"/api/menu/{other_wedding_option.id}"
        )
        assert response.status_code == 404

    def test_list_excludes_other_weddings_options(
        self,
        coordinator_session: TestClient,
        other_wedding_option: MenuOption,
    ) -> None:
        response = coordinator_session.get("/api/menu")
        assert response.status_code == 200
        ids = [item["id"] for item in response.json()]
        assert other_wedding_option.id not in ids


class TestGuestAccess:
    def test_guest_cannot_list_coordinator_menu(
        self, guest_session: TestClient
    ) -> None:
        assert guest_session.get("/api/menu").status_code == 403

    def test_guest_cannot_create(self, guest_session: TestClient) -> None:
        response = guest_session.post(
            "/api/menu", json={"name": f"{TEST_OPTION_PREFIX} Sneaky"}
        )
        assert response.status_code == 403

    def test_guest_cannot_patch(
        self, guest_session: TestClient, db_session: Session
    ) -> None:
        option = make_option(db_session)
        response = guest_session.patch(
            f"/api/menu/{option.id}", json={"active": False}
        )
        assert response.status_code == 403

    def test_guest_cannot_delete(
        self, guest_session: TestClient, db_session: Session
    ) -> None:
        option = make_option(db_session)
        assert guest_session.delete(f"/api/menu/{option.id}").status_code == 403


class TestPortalMenu:
    def test_returns_active_options_only(
        self, guest_session: TestClient, db_session: Session
    ) -> None:
        active = make_option(db_session, is_vegan=True)
        inactive = make_option(db_session, active=False)

        response = guest_session.get("/api/portal/menu")
        assert response.status_code == 200
        data = response.json()
        ids = [item["id"] for item in data["options"]]
        assert active.id in ids
        assert inactive.id not in ids
        served = next(item for item in data["options"] if item["id"] == active.id)
        assert served["is_vegan"] is True
        # Coordinator-only bookkeeping stays out of the guest payload.
        assert "active" not in served
        assert "wedding_id" not in served

    def test_includes_meal_selection_open_flag(
        self, guest_session: TestClient, set_meal_selection
    ) -> None:
        set_meal_selection(False)
        closed = guest_session.get("/api/portal/menu")
        assert closed.status_code == 200
        assert closed.json()["meal_selection_open"] is False

        set_meal_selection(True)
        opened = guest_session.get("/api/portal/menu")
        assert opened.status_code == 200
        assert opened.json()["meal_selection_open"] is True

    def test_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/portal/menu").status_code == 401


class TestSettingsSwitch:
    def test_coordinator_can_toggle_meal_selection(
        self, coordinator_session: TestClient, set_meal_selection
    ) -> None:
        set_meal_selection(False)

        response = coordinator_session.put(
            "/api/settings/wedding", json={"meal_selection_open": True}
        )
        assert response.status_code == 200
        assert response.json()["meal_selection_open"] is True

        response = coordinator_session.put(
            "/api/settings/wedding", json={"meal_selection_open": False}
        )
        assert response.status_code == 200
        assert response.json()["meal_selection_open"] is False

    def test_settings_get_exposes_flag(
        self, coordinator_session: TestClient
    ) -> None:
        response = coordinator_session.get("/api/settings/wedding")
        assert response.status_code == 200
        assert isinstance(response.json()["meal_selection_open"], bool)


class TestRsvpMealGating:
    """RSVP PATCH accepts meal fields only while meal selection is open.

    NOTE: coordinator_session and guest_session share one TestClient and would
    clobber each other's login in the same test, so every test here uses a
    single session (its own guest invite via login_own_guest, or a fixture).
    """

    pytestmark = pytest.mark.usefixtures("clean_test_guests", "clean_menu_invites")

    def test_meal_rejected_while_closed(
        self,
        client: TestClient,
        db_session: Session,
        set_meal_selection,
    ) -> None:
        set_meal_selection(False)
        guest = login_own_guest(client, db_session, "Menu Closed Guest")

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"rsvp_status": "accepted", "meal_choice": "anything"},
        )
        assert response.status_code == 403
        assert response.json() == {"detail": "Meal selection is not currently open."}

    def test_plus_one_meal_rejected_while_closed(
        self,
        client: TestClient,
        db_session: Session,
        set_meal_selection,
    ) -> None:
        set_meal_selection(False)
        guest = login_own_guest(client, db_session, "Menu Closed Plus One")

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"plus_one_meal_choice": "anything"},
        )
        assert response.status_code == 403

    def test_dietary_only_rsvp_still_works_while_closed(
        self,
        client: TestClient,
        db_session: Session,
        set_meal_selection,
    ) -> None:
        set_meal_selection(False)
        guest = login_own_guest(client, db_session, "Menu Closed Dietary")

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={
                "rsvp_status": "accepted",
                "dietary_notes": "No shellfish",
                "plus_one_name": "Casey Plus",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["rsvp_status"] == "accepted"
        assert data["dietary_notes"] == "No shellfish"
        assert data["meal_choice"] is None

    def test_meal_accepted_while_open(
        self,
        client: TestClient,
        db_session: Session,
        set_meal_selection,
    ) -> None:
        set_meal_selection(True)
        option = make_option(db_session)
        guest = login_own_guest(client, db_session, "Menu Open Guest")

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"rsvp_status": "accepted", "meal_choice": option.name},
        )
        assert response.status_code == 200
        assert response.json()["meal_choice"] == option.name

        db_session.expire_all()
        persisted = db_session.get(Guest, guest.id)
        assert persisted is not None
        assert persisted.meal_choice == option.name

    def test_plus_one_meal_stored_while_open(
        self,
        client: TestClient,
        db_session: Session,
        set_meal_selection,
    ) -> None:
        set_meal_selection(True)
        guest_option = make_option(db_session)
        plus_one_option = make_option(db_session)
        guest = login_own_guest(client, db_session, "Menu Open Plus One")

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={
                "rsvp_status": "accepted",
                "plus_one_name": "Jordan Plus",
                "meal_choice": guest_option.name,
                "plus_one_meal_choice": plus_one_option.name,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["meal_choice"] == guest_option.name
        assert data["plus_one_meal_choice"] == plus_one_option.name

        db_session.expire_all()
        persisted = db_session.get(Guest, guest.id)
        assert persisted is not None
        assert persisted.plus_one_meal_choice == plus_one_option.name

    def test_unknown_option_rejected_while_open(
        self,
        client: TestClient,
        db_session: Session,
        set_meal_selection,
    ) -> None:
        set_meal_selection(True)
        make_option(db_session)
        guest = login_own_guest(client, db_session, "Menu Unknown Option")

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"meal_choice": f"{TEST_OPTION_PREFIX} Nonexistent Dish"},
        )
        assert response.status_code == 422

    def test_inactive_option_rejected_while_open(
        self,
        client: TestClient,
        db_session: Session,
        set_meal_selection,
    ) -> None:
        set_meal_selection(True)
        retired = make_option(db_session, active=False)
        guest = login_own_guest(client, db_session, "Menu Inactive Option")

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"meal_choice": retired.name},
        )
        assert response.status_code == 422

    def test_null_meal_clears_choice_while_open(
        self,
        client: TestClient,
        db_session: Session,
        set_meal_selection,
    ) -> None:
        set_meal_selection(True)
        option = make_option(db_session)
        guest = login_own_guest(client, db_session, "Menu Clear Choice")

        first = client.patch(
            f"/api/guests/{guest.id}", json={"meal_choice": option.name}
        )
        assert first.status_code == 200

        cleared = client.patch(f"/api/guests/{guest.id}", json={"meal_choice": None})
        assert cleared.status_code == 200
        assert cleared.json()["meal_choice"] is None


class TestUnauthenticated:
    def test_all_menu_endpoints_require_authentication(
        self, client: TestClient
    ) -> None:
        assert client.get("/api/menu").status_code == 401
        assert client.post("/api/menu", json={"name": "x"}).status_code == 401
        assert client.patch("/api/menu/1", json={"name": "x"}).status_code == 401
        assert client.delete("/api/menu/1").status_code == 401
        assert client.get("/api/portal/menu").status_code == 401
