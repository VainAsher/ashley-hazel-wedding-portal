"""In-app notifications: send fan-out + the member-facing notifications API.

The recipient of a notification is the invite (the durable per-member
identity that sessions carry as invite_id).

NOTE: coordinator_session and guest_session share the same underlying
TestClient, so no test here uses both — coordinator tests verify fan-out
through the DB, guest tests seed rows through the DB.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.models import Communication, Invite, Notification, Wedding
from tests.fixtures.guests import TEST_WEDDING_ID


TEST_CODE_PREFIX = "PYTEST-NOTIF-"
TEST_TITLE_PREFIX = "Pytest Notification "


def communication_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "subject": f"Pytest Notification {uuid4().hex[:8]}",
        "body": "Hello members, here is an update.",
        "channel": "announcement",
        "audience": "all",
        "status": "draft",
    }
    body.update(overrides)
    return body


def cleanup_notification_test_rows(session: Session) -> None:
    session.query(Notification).filter(
        Notification.title.like(f"{TEST_TITLE_PREFIX}%")
    ).delete(synchronize_session=False)
    session.query(Communication).filter(
        Communication.subject.like(f"{TEST_TITLE_PREFIX}%")
    ).delete(synchronize_session=False)
    # Deleting the invites cascades any remaining notifications for them.
    session.query(Invite).filter(
        Invite.code.like(f"{TEST_CODE_PREFIX}%")
    ).delete(synchronize_session=False)
    session.commit()


@pytest.fixture()
def cleanup_notifications() -> Iterator[None]:
    yield
    session = SessionLocal()
    try:
        cleanup_notification_test_rows(session)
    finally:
        session.close()


def make_invite(db_session: Session, role: str, wedding_id: int = TEST_WEDDING_ID) -> Invite:
    invite = Invite(
        code=f"{TEST_CODE_PREFIX}{role.upper()}-{uuid4().hex[:8].upper()}",
        wedding_id=wedding_id,
        household_name=f"Pytest Notification {role}",
        role=role,
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def make_notification(
    db_session: Session,
    invite_id: int,
    *,
    wedding_id: int = TEST_WEDDING_ID,
    title: str | None = None,
    created_at: datetime | None = None,
    read_at: datetime | None = None,
) -> Notification:
    notification = Notification(
        wedding_id=wedding_id,
        recipient_invite_id=invite_id,
        kind="system",
        title=title or f"{TEST_TITLE_PREFIX}{uuid4().hex[:8]}",
        body="Seeded by pytest",
        link_path="/dashboard",
        created_at=created_at or datetime.now(timezone.utc),
        read_at=read_at,
    )
    db_session.add(notification)
    db_session.commit()
    db_session.refresh(notification)
    return notification


def notifications_for_invite(db_session: Session, invite_id: int) -> list[Notification]:
    db_session.expire_all()
    return (
        db_session.query(Notification)
        .filter(Notification.recipient_invite_id == invite_id)
        .all()
    )


def send_communication(client: TestClient, **overrides: object) -> dict[str, object]:
    created = client.post("/api/communications", json=communication_body(**overrides))
    assert created.status_code == 201
    communication = created.json()
    sent = client.post(f"/api/communications/{communication['id']}/send")
    assert sent.status_code == 200
    return sent.json()


class TestSendFanOut:
    def test_send_all_notifies_every_invite(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        guest_invite = make_invite(db_session, "guest")
        me = coordinator_session.get("/api/auth/me").json()

        sent = send_communication(coordinator_session, audience="all")

        for invite_id in (guest_invite.id, me["invite_id"]):
            rows = [
                n
                for n in notifications_for_invite(db_session, invite_id)
                if n.title == sent["subject"]
            ]
            assert len(rows) == 1
            row = rows[0]
            assert row.kind == "communication"
            assert row.body == sent["body"]
            assert row.link_path == "/dashboard"
            assert row.wedding_id == TEST_WEDDING_ID
            assert row.read_at is None
            assert row.created_at is not None

    def test_send_guests_only_skips_coordinator_invite(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        guest_invite = make_invite(db_session, "guest")
        me = coordinator_session.get("/api/auth/me").json()

        sent = send_communication(coordinator_session, audience="guests")

        guest_rows = notifications_for_invite(db_session, guest_invite.id)
        assert sent["subject"] in {n.title for n in guest_rows}
        coordinator_rows = notifications_for_invite(db_session, me["invite_id"])
        assert sent["subject"] not in {n.title for n in coordinator_rows}

    def test_send_coordinators_only_skips_guest_invite(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        guest_invite = make_invite(db_session, "guest")
        me = coordinator_session.get("/api/auth/me").json()

        sent = send_communication(coordinator_session, audience="coordinators")

        coordinator_rows = notifications_for_invite(db_session, me["invite_id"])
        assert sent["subject"] in {n.title for n in coordinator_rows}
        guest_rows = notifications_for_invite(db_session, guest_invite.id)
        assert sent["subject"] not in {n.title for n in guest_rows}

    @pytest.mark.parametrize("audience", ["wedding_party", "stags", "hens"])
    def test_party_audiences_accepted_but_notify_nobody_yet(
        self,
        audience: str,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        # Party flags land in Wave 3; the enum ships now and matches nothing.
        sent = send_communication(coordinator_session, audience=audience)
        assert sent["status"] == "sent"

        db_session.expire_all()
        rows = (
            db_session.query(Notification)
            .filter(Notification.title == sent["subject"])
            .count()
        )
        assert rows == 0

    def test_invalid_audience_rejected(
        self, coordinator_session: TestClient
    ) -> None:
        response = coordinator_session.post(
            "/api/communications", json=communication_body(audience="everyone")
        )
        assert response.status_code == 422


class TestNotificationsApi:
    def test_get_returns_only_mine_newest_first_with_unread_count(
        self,
        guest_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        me = guest_session.get("/api/auth/me").json()
        my_invite_id = me["invite_id"]
        other_invite = make_invite(db_session, "guest")

        base = datetime.now(timezone.utc)
        oldest = make_notification(
            db_session, my_invite_id, created_at=base - timedelta(minutes=2)
        )
        middle = make_notification(
            db_session,
            my_invite_id,
            created_at=base - timedelta(minutes=1),
            read_at=base,
        )
        newest = make_notification(db_session, my_invite_id, created_at=base)
        make_notification(db_session, other_invite.id, created_at=base)

        response = guest_session.get("/api/notifications")
        assert response.status_code == 200
        payload = response.json()

        ids = [item["id"] for item in payload["items"]]
        assert ids == [newest.id, middle.id, oldest.id]
        assert payload["unread_count"] == 2
        assert all(item["wedding_id"] == TEST_WEDDING_ID for item in payload["items"])

    def test_mark_read_sets_read_at(
        self,
        guest_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        me = guest_session.get("/api/auth/me").json()
        notification = make_notification(db_session, me["invite_id"])

        response = guest_session.post(f"/api/notifications/{notification.id}/read")
        assert response.status_code == 200
        assert response.json()["read_at"] is not None

        listed = guest_session.get("/api/notifications").json()
        assert listed["unread_count"] == 0

        # Marking read twice is harmless.
        again = guest_session.post(f"/api/notifications/{notification.id}/read")
        assert again.status_code == 200

    def test_read_all_marks_everything_mine(
        self,
        guest_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        me = guest_session.get("/api/auth/me").json()
        make_notification(db_session, me["invite_id"])
        make_notification(db_session, me["invite_id"])
        other_invite = make_invite(db_session, "guest")
        other = make_notification(db_session, other_invite.id)

        response = guest_session.post("/api/notifications/read-all")
        assert response.status_code == 200
        assert response.json()["updated"] == 2

        listed = guest_session.get("/api/notifications").json()
        assert listed["unread_count"] == 0

        # Another member's notification is untouched.
        db_session.expire_all()
        assert db_session.get(Notification, other.id).read_at is None

    def test_cross_member_notification_returns_404(
        self,
        guest_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        other_invite = make_invite(db_session, "guest")
        other = make_notification(db_session, other_invite.id)

        response = guest_session.post(f"/api/notifications/{other.id}/read")
        assert response.status_code == 404

    def test_cross_wedding_notification_returns_404(
        self,
        guest_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        other_wedding = Wedding(
            couple_names="Pytest Notification Couple",
            wedding_date=datetime.now(timezone.utc).date(),
        )
        db_session.add(other_wedding)
        db_session.commit()
        db_session.refresh(other_wedding)
        try:
            other_invite = make_invite(
                db_session, "guest", wedding_id=other_wedding.id
            )
            other = make_notification(
                db_session, other_invite.id, wedding_id=other_wedding.id
            )

            response = guest_session.post(f"/api/notifications/{other.id}/read")
            assert response.status_code == 404
        finally:
            # Bulk delete so the DB-level ON DELETE CASCADE removes the
            # invite + notification (ORM delete would try to NULL the FKs).
            db_session.query(Wedding).filter(
                Wedding.id == other_wedding.id
            ).delete(synchronize_session=False)
            db_session.commit()

    def test_missing_notification_returns_404(
        self, guest_session: TestClient
    ) -> None:
        response = guest_session.post("/api/notifications/999999999/read")
        assert response.status_code == 404

    def test_guest_access_is_not_phase_gated(
        self,
        guest_session: TestClient,
        db_session: Session,
        cleanup_notifications: None,
    ) -> None:
        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        original_phase = wedding.phase
        wedding.phase = "planning"
        db_session.commit()
        try:
            response = guest_session.get("/api/notifications")
            assert response.status_code == 200
        finally:
            db_session.expire_all()
            wedding = db_session.get(Wedding, TEST_WEDDING_ID)
            wedding.phase = original_phase
            db_session.commit()

    def test_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/notifications").status_code == 401
        assert client.post("/api/notifications/1/read").status_code == 401
        assert client.post("/api/notifications/read-all").status_code == 401
