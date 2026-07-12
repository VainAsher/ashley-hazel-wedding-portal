"""Wave 3 item 14 D2 — mounting the Kanban V2 task board inside the Stag &
Hen party portals.

The original Kanban V2 rollout (docs/specs/KANBAN_V2.md) added a `context`
column to `tasks` and `?context=` filtering, but every mutation endpoint
still gated on `require_coordinator` regardless of context — fine while only
the admin Timeline (always `context='wedding'`) used the board, but wrong
the moment a party's own members need to manage their own board without
holding a coordinator role.

This suite exercises the fix: `context='wedding'` keeps the original
coordinator/couple-only gate; `context in ('stag', 'hen')` is instead gated
by the exact same `has_party_access` rule that guards the rest of that
party's content (docs/specs/PARTY_PORTALS_D1.md). Per that spec,
coordinators deliberately do NOT get automatic access to a party's own
content by default — this suite asserts that decision carries over to the
task board too (see app/api/tasks.py::_authorize_task_context for the
rollout note flagging this as a judgment call).

As in tests/test_party.py, every assertion goes through the real HTTP API
with a real logged-in session — never a direct call to the authorization
helper.
"""

from __future__ import annotations

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Guest, Invite, Task, Wedding
from tests.fixtures.guests import TEST_WEDDING_ID, unique_guest_email

TEST_INVITE_PREFIX = "PYTEST-TASKPARTY"
TEST_TASK_TITLE_PREFIX = "Pytest taskparty"


def unique_code(label: str) -> str:
    return f"{TEST_INVITE_PREFIX}-{label}-{uuid4().hex[:8].upper()}"


def make_guest_invite(
    db_session: Session,
    *,
    party: str | None = None,
    party_admin: bool = False,
    name: str = "Pytest Taskparty Guest",
    wedding_id: int = TEST_WEDDING_ID,
) -> Invite:
    guest = Guest(
        wedding_id=wedding_id,
        name=name,
        email=unique_guest_email("taskparty"),
        relationship="friend",
    )
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)

    invite = Invite(
        code=unique_code("GUEST"),
        wedding_id=wedding_id,
        guest_id=guest.id,
        household_name=name,
        role="guest",
        party=party,
        party_admin=party_admin,
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def make_couple_invite(
    db_session: Session,
    *,
    associated_party: str | None = None,
    household_name: str = "Pytest Taskparty Couple Member",
    wedding_id: int = TEST_WEDDING_ID,
) -> Invite:
    invite = Invite(
        code=unique_code("COUPLE"),
        wedding_id=wedding_id,
        household_name=household_name,
        role="couple",
        associated_party=associated_party,
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def make_coordinator_invite(db_session: Session, wedding_id: int = TEST_WEDDING_ID) -> Invite:
    invite = Invite(
        code=unique_code("COORD"),
        wedding_id=wedding_id,
        household_name="Pytest Taskparty Coordinator",
        role="coordinator",
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def login(client: TestClient, invite: Invite) -> None:
    response = client.post("/api/auth/login", json={"invite_code": invite.code})
    assert response.status_code == 200


def create_task(
    session: TestClient, *, context: str = "wedding", **overrides: object
) -> dict:
    payload = {
        "wedding_id": TEST_WEDDING_ID,
        "title": f"{TEST_TASK_TITLE_PREFIX} {uuid4().hex[:8]}",
        "status": "not_started",
        "priority": "medium",
        "context": context,
        **overrides,
    }
    return session.post("/api/tasks", json=payload)


@pytest.fixture(autouse=True)
def cleanup_taskparty_state(db_session: Session) -> Iterator[None]:
    def _purge() -> None:
        db_session.query(Task).filter(
            Task.title.like(f"{TEST_TASK_TITLE_PREFIX}%")
        ).delete(synchronize_session=False)
        db_session.query(Invite).filter(
            Invite.code.like(f"{TEST_INVITE_PREFIX}-%")
        ).delete(synchronize_session=False)
        db_session.query(Guest).filter(
            Guest.email.like("pytest-guest-taskparty-%")
        ).delete(synchronize_session=False)
        db_session.commit()

    _purge()
    yield
    db_session.rollback()
    _purge()


class TestWeddingContextUnaffected:
    """Sanity check: the D2 rewrite must not change `context='wedding'`
    behavior — it stays coordinator/couple-only, guests still denied."""

    def test_coordinator_manages_wedding_tasks(self, db_session: Session, client: TestClient) -> None:
        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)
        response = create_task(client, context="wedding")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["context"] == "wedding"

    def test_guest_with_no_party_denied_wedding_tasks(
        self, db_session: Session, client: TestClient
    ) -> None:
        guest = make_guest_invite(db_session, party=None)
        login(client, guest)
        response = create_task(client, context="wedding")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_stag_member_denied_wedding_tasks(
        self, db_session: Session, client: TestClient
    ) -> None:
        """A stag member gains their own board — not the couple's wedding
        board."""
        stag_member = make_guest_invite(db_session, party="stag")
        login(client, stag_member)
        response = create_task(client, context="wedding")
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestPartyContextAccessMatrix:
    """The security-critical matrix: `context in ('stag', 'hen')` gated by
    `has_party_access`, exercised across create/list/move/update/delete."""

    def test_stag_member_can_create_and_list_stag_tasks(
        self, db_session: Session, client: TestClient
    ) -> None:
        stag_member = make_guest_invite(db_session, party="stag")
        login(client, stag_member)

        create_response = create_task(client, context="stag")
        assert create_response.status_code == status.HTTP_201_CREATED

        list_response = client.get("/api/tasks?context=stag")
        assert list_response.status_code == status.HTTP_200_OK
        titles = {t["title"] for t in list_response.json()}
        assert create_response.json()["title"] in titles

    def test_hen_member_denied_on_stag_tasks(
        self, db_session: Session, client: TestClient
    ) -> None:
        hen_member = make_guest_invite(db_session, party="hen")
        login(client, hen_member)

        assert create_task(client, context="stag").status_code == status.HTTP_403_FORBIDDEN
        assert client.get("/api/tasks?context=stag").status_code == status.HTTP_403_FORBIDDEN

    def test_stag_member_denied_on_hen_tasks(
        self, db_session: Session, client: TestClient
    ) -> None:
        stag_member = make_guest_invite(db_session, party="stag")
        login(client, stag_member)

        assert create_task(client, context="hen").status_code == status.HTTP_403_FORBIDDEN
        assert client.get("/api/tasks?context=hen").status_code == status.HTTP_403_FORBIDDEN

    def test_guest_with_no_party_denied_both_boards(
        self, db_session: Session, client: TestClient
    ) -> None:
        guest = make_guest_invite(db_session, party=None)
        login(client, guest)
        assert create_task(client, context="stag").status_code == status.HTTP_403_FORBIDDEN
        assert create_task(client, context="hen").status_code == status.HTTP_403_FORBIDDEN

    def test_party_admin_can_manage_own_board(
        self, db_session: Session, client: TestClient
    ) -> None:
        """Best Man / Maid of Honour manage the board the same way any other
        party member does — has_party_access does not distinguish admin from
        plain member for a guest invite (that distinction only matters for
        message moderation, not task management)."""
        best_man = make_guest_invite(db_session, party="stag", party_admin=True)
        login(client, best_man)
        response = create_task(client, context="stag")
        assert response.status_code == status.HTTP_201_CREATED

    def test_plain_stag_member_can_also_manage_board(
        self, db_session: Session, client: TestClient
    ) -> None:
        """Not just the admin — any party member can create/edit/move, same
        as the shared planning-tool framing in the D2 rollout notes."""
        member = make_guest_invite(db_session, party="stag", party_admin=False)
        login(client, member)
        response = create_task(client, context="stag")
        assert response.status_code == status.HTTP_201_CREATED

    def test_couple_subject_without_access_denied_own_party_tasks(
        self, db_session: Session, client: TestClient
    ) -> None:
        """The couple subject of a party (e.g. the groom for stag) is denied
        their own party's tasks exactly like they're denied its message
        board — the reveal rule is the reveal rule."""
        subject = make_couple_invite(db_session, associated_party="stag")
        login(client, subject)
        assert create_task(client, context="stag").status_code == status.HTTP_403_FORBIDDEN

    def test_coordinator_denied_stag_context(
        self, db_session: Session, client: TestClient
    ) -> None:
        """Documented decision: coordinators do NOT get automatic access to
        party task boards, for consistency with PARTY_PORTALS_D1.md's
        message-board/details/membership exclusion. Flagged for the couple
        to confirm; easy to reverse if they'd rather coordinators keep
        visibility into party planning specifically."""
        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)
        assert create_task(client, context="stag").status_code == status.HTTP_403_FORBIDDEN
        assert create_task(client, context="hen").status_code == status.HTTP_403_FORBIDDEN
        assert client.get("/api/tasks?context=stag").status_code == status.HTTP_403_FORBIDDEN
        assert client.get("/api/tasks?context=hen").status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_denied(self, client: TestClient) -> None:
        response = client.get("/api/tasks?context=stag")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestPartyContextMutations:
    """get/update/move/delete on an existing party-context task follow the
    same rule as create/list."""

    def test_stag_member_can_edit_move_and_delete_own_task(
        self, db_session: Session, client: TestClient
    ) -> None:
        creator = make_guest_invite(db_session, party="stag", name="Pytest Taskparty Creator")
        login(client, creator)
        task = create_task(client, context="stag").json()

        update_response = client.patch(
            f"/api/tasks/{task['id']}", json={"title": "Updated by stag member"}
        )
        assert update_response.status_code == status.HTTP_200_OK

        move_response = client.patch(
            f"/api/tasks/{task['id']}/move", json={"status": "in_progress", "position": 0}
        )
        assert move_response.status_code == status.HTTP_200_OK

        get_response = client.get(f"/api/tasks/{task['id']}")
        assert get_response.status_code == status.HTTP_200_OK

        delete_response = client.delete(f"/api/tasks/{task['id']}")
        assert delete_response.status_code == status.HTTP_204_NO_CONTENT

    def test_hen_member_cannot_get_update_move_or_delete_stag_task(
        self, db_session: Session, client: TestClient
    ) -> None:
        creator = make_guest_invite(db_session, party="stag")
        login(client, creator)
        task = create_task(client, context="stag").json()
        client.post("/api/auth/logout")

        hen_member = make_guest_invite(db_session, party="hen")
        login(client, hen_member)

        assert client.get(f"/api/tasks/{task['id']}").status_code == status.HTTP_403_FORBIDDEN
        assert (
            client.patch(f"/api/tasks/{task['id']}", json={"title": "Hijack"}).status_code
            == status.HTTP_403_FORBIDDEN
        )
        assert (
            client.patch(
                f"/api/tasks/{task['id']}/move", json={"status": "done", "position": 0}
            ).status_code
            == status.HTTP_403_FORBIDDEN
        )
        assert client.delete(f"/api/tasks/{task['id']}").status_code == status.HTTP_403_FORBIDDEN

    def test_coordinator_cannot_get_update_move_or_delete_stag_task(
        self, db_session: Session, client: TestClient
    ) -> None:
        creator = make_guest_invite(db_session, party="stag")
        login(client, creator)
        task = create_task(client, context="stag").json()
        client.post("/api/auth/logout")

        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)

        assert client.get(f"/api/tasks/{task['id']}").status_code == status.HTTP_403_FORBIDDEN
        assert (
            client.patch(f"/api/tasks/{task['id']}", json={"title": "Hijack"}).status_code
            == status.HTTP_403_FORBIDDEN
        )
        assert (
            client.patch(
                f"/api/tasks/{task['id']}/move", json={"status": "done", "position": 0}
            ).status_code
            == status.HTTP_403_FORBIDDEN
        )
        assert client.delete(f"/api/tasks/{task['id']}").status_code == status.HTTP_403_FORBIDDEN

    def test_stag_member_cannot_promote_task_onto_wedding_board(
        self, db_session: Session, client: TestClient
    ) -> None:
        """A context change is itself privileged: a stag member must not be
        able to relabel their task as `context='wedding'` to smuggle it onto
        the coordinator-only board."""
        creator = make_guest_invite(db_session, party="stag")
        login(client, creator)
        task = create_task(client, context="stag").json()

        response = client.patch(f"/api/tasks/{task['id']}", json={"context": "wedding"})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_coordinator_cannot_drop_wedding_task_onto_stag_board(
        self, db_session: Session, client: TestClient
    ) -> None:
        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)
        task = create_task(client, context="wedding").json()

        response = client.patch(f"/api/tasks/{task['id']}", json={"context": "stag"})
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestCrossPartyIsolation:
    """The context filter must never leak one party's tasks into the
    other's listing — the security-relevant boundary the frontend's board
    depends on entirely."""

    def test_stag_and_hen_lists_never_cross_contaminate(
        self, db_session: Session, client: TestClient
    ) -> None:
        stag_member = make_guest_invite(db_session, party="stag")
        login(client, stag_member)
        stag_task = create_task(client, context="stag").json()
        client.post("/api/auth/logout")

        hen_member = make_guest_invite(db_session, party="hen")
        login(client, hen_member)
        hen_task = create_task(client, context="hen").json()

        hen_titles = {t["title"] for t in client.get("/api/tasks?context=hen").json()}
        assert hen_task["title"] in hen_titles
        assert stag_task["title"] not in hen_titles


class TestCrossWeddingIsolation:
    @pytest.fixture()
    def other_wedding(self, db_session: Session) -> Iterator[Wedding]:
        from datetime import date

        wedding = Wedding(
            couple_names="Pytest Taskparty Other Couple", wedding_date=date(2030, 6, 1)
        )
        db_session.add(wedding)
        db_session.commit()
        db_session.refresh(wedding)
        try:
            yield wedding
        finally:
            db_session.query(Task).filter(Task.wedding_id == wedding.id).delete(
                synchronize_session=False
            )
            db_session.query(Invite).filter(Invite.wedding_id == wedding.id).delete(
                synchronize_session=False
            )
            db_session.query(Wedding).filter(Wedding.id == wedding.id).delete(
                synchronize_session=False
            )
            db_session.commit()

    def test_stag_member_cannot_reach_other_weddings_stag_task(
        self, db_session: Session, client: TestClient, other_wedding: Wedding
    ) -> None:
        other_task = Task(
            wedding_id=other_wedding.id,
            title=f"{TEST_TASK_TITLE_PREFIX} other-wedding",
            status="not_started",
            priority="medium",
            context="stag",
            position=0,
        )
        db_session.add(other_task)
        db_session.commit()
        db_session.refresh(other_task)

        stag_member = make_guest_invite(db_session, party="stag")
        login(client, stag_member)

        response = client.get(f"/api/tasks/{other_task.id}")
        assert response.status_code == status.HTTP_403_FORBIDDEN

        move_response = client.patch(
            f"/api/tasks/{other_task.id}/move", json={"status": "done", "position": 0}
        )
        assert move_response.status_code == status.HTTP_404_NOT_FOUND
