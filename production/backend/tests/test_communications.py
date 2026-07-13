from __future__ import annotations

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api import communications as communications_module
from app.db.models import Communication, Guest, Invite, Notification, RsvpStatus
from tests.fixtures.guests import TEST_WEDDING_ID, unique_guest_email


def communication_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "subject": f"Pytest Communication {uuid4().hex[:8]}",
        "body": "Hello guests, here is an update.",
        "channel": "email",
        "audience": "all",
        "status": "draft",
    }
    body.update(overrides)
    return body


@pytest.fixture()
def cleanup_communications(db_session: Session) -> Iterator[None]:
    yield
    db_session.query(Communication).filter(
        Communication.subject.like("Pytest Communication %")
    ).delete(synchronize_session=False)
    db_session.commit()


class TestCommunicationIntegration:
    def test_full_communication_lifecycle(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_communications: None,
    ) -> None:
        # wedding_id intentionally omitted from the body; handler defaults it.
        created = coordinator_session.post(
            "/api/communications", json=communication_body()
        )
        assert created.status_code == 201
        data = created.json()
        communication_id = int(data["id"])
        assert data["wedding_id"] == TEST_WEDDING_ID
        assert data["status"] == "draft"
        assert data["sent_at"] is None

        listed = coordinator_session.get("/api/communications")
        assert listed.status_code == 200
        assert communication_id in {c["id"] for c in listed.json()}

        updated = coordinator_session.put(
            f"/api/communications/{communication_id}",
            json={"subject": "Updated Subject", "audience": "attending"},
        )
        assert updated.status_code == 200
        assert updated.json()["subject"] == "Updated Subject"
        assert updated.json()["audience"] == "attending"

        sent = coordinator_session.post(
            f"/api/communications/{communication_id}/send"
        )
        assert sent.status_code == 200
        sent_data = sent.json()
        assert sent_data["status"] == "sent"
        assert sent_data["sent_at"] is not None

        db_session.expire_all()
        persisted = db_session.get(Communication, communication_id)
        assert persisted is not None
        assert persisted.status == "sent"
        assert persisted.sent_at is not None

        deleted = coordinator_session.delete(
            f"/api/communications/{communication_id}"
        )
        assert deleted.status_code == 200
        db_session.expire_all()
        assert db_session.get(Communication, communication_id) is None

    def test_create_other_wedding_rejected(
        self,
        coordinator_session: TestClient,
        cleanup_communications: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/communications", json=communication_body(wedding_id=999999)
        )
        assert response.status_code == 403

    def test_invalid_channel_rejected(
        self,
        coordinator_session: TestClient,
    ) -> None:
        response = coordinator_session.post(
            "/api/communications", json=communication_body(channel="carrier-pigeon")
        )
        assert response.status_code == 422

    def test_invalid_status_rejected(
        self,
        coordinator_session: TestClient,
    ) -> None:
        response = coordinator_session.post(
            "/api/communications", json=communication_body(status="bogus")
        )
        assert response.status_code == 422

    def test_update_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.put(
            "/api/communications/999999", json={"subject": "x"}
        )
        assert response.status_code == 404

    def test_delete_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.delete("/api/communications/999999")
        assert response.status_code == 404

    def test_send_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.post("/api/communications/999999/send")
        assert response.status_code == 404

    def test_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/communications").status_code == 401
        assert (
            client.post("/api/communications", json=communication_body()).status_code
            == 401
        )
        assert client.post("/api/communications/1/send").status_code == 401


class FakeResendResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


class TestSendEmailBatch:
    """Unit tests for send_email_batch with httpx stubbed — no network calls."""

    def test_payload_shape(self, monkeypatch: pytest.MonkeyPatch) -> None:
        settings = communications_module.get_settings()
        monkeypatch.setattr(settings, "resend_api_key", "test-resend-key")
        monkeypatch.setattr(
            settings, "email_from_address", "Test <test@example.com>"
        )

        calls: list[dict[str, object]] = []

        def fake_post(url: str, **kwargs: object) -> FakeResendResponse:
            calls.append({"url": url, **kwargs})
            return FakeResendResponse(200)

        monkeypatch.setattr(communications_module.httpx, "post", fake_post)

        accepted = communications_module.send_email_batch(
            [("guest1@example.com", "Guest One"), ("guest2@example.com", "")],
            "Subject Line",
            "<p>Body</p>",
        )

        assert accepted == 2
        assert len(calls) == 1
        call = calls[0]
        assert call["url"] == "https://api.resend.com/emails/batch"
        assert call["headers"] == {"Authorization": "Bearer test-resend-key"}
        assert call["json"] == [
            {
                "from": "Test <test@example.com>",
                "to": ["Guest One <guest1@example.com>"],
                "subject": "Subject Line",
                "html": "<p>Body</p>",
            },
            {
                "from": "Test <test@example.com>",
                "to": ["guest2@example.com"],
                "subject": "Subject Line",
                "html": "<p>Body</p>",
            },
        ]

    def test_chunks_at_100_recipients(self, monkeypatch: pytest.MonkeyPatch) -> None:
        settings = communications_module.get_settings()
        monkeypatch.setattr(settings, "resend_api_key", "test-resend-key")

        seen_chunks: list[list[object]] = []

        def fake_post(url: str, json: list[object], **kwargs: object) -> FakeResendResponse:
            seen_chunks.append(json)
            return FakeResendResponse(200)

        monkeypatch.setattr(communications_module.httpx, "post", fake_post)

        recipients = [(f"guest{i}@example.com", f"Guest {i}") for i in range(150)]
        accepted = communications_module.send_email_batch(
            recipients, "Subject", "<p>Body</p>"
        )

        assert accepted == 150
        assert len(seen_chunks) == 2
        assert len(seen_chunks[0]) == 100
        assert len(seen_chunks[1]) == 50

    def test_non_2xx_response_does_not_raise(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        settings = communications_module.get_settings()
        monkeypatch.setattr(settings, "resend_api_key", "test-resend-key")
        monkeypatch.setattr(
            communications_module.httpx,
            "post",
            lambda *a, **k: FakeResendResponse(500),
        )

        accepted = communications_module.send_email_batch(
            [("guest@example.com", "Guest")], "Subject", "<p>Body</p>"
        )
        assert accepted == 0

    def test_exception_does_not_raise(self, monkeypatch: pytest.MonkeyPatch) -> None:
        settings = communications_module.get_settings()
        monkeypatch.setattr(settings, "resend_api_key", "test-resend-key")

        def boom(*args: object, **kwargs: object) -> FakeResendResponse:
            raise RuntimeError("simulated network failure")

        monkeypatch.setattr(communications_module.httpx, "post", boom)

        accepted = communications_module.send_email_batch(
            [("guest@example.com", "Guest")], "Subject", "<p>Body</p>"
        )
        assert accepted == 0


@pytest.fixture()
def email_test_invites(db_session: Session) -> Iterator[list[Invite]]:
    """One invite each: linked guest w/ email, linked guest w/o email, no guest.

    Used to exercise the exact recipient-resolution rule in send_communication:
    only invites with a linked guest AND a non-null guest email should be
    passed to send_email_batch, while all three still get the (unconditional,
    already-shipped) in-app notification.
    """
    guest_with_email = Guest(
        wedding_id=TEST_WEDDING_ID,
        name="Pytest Comms Email Guest",
        email=unique_guest_email("comms-email"),
        relationship="friend",
        rsvp_status=RsvpStatus.accepted,
    )
    guest_without_email = Guest(
        wedding_id=TEST_WEDDING_ID,
        name="Pytest Comms No-Email Guest",
        email=None,
        relationship="friend",
        rsvp_status=RsvpStatus.accepted,
    )
    db_session.add_all([guest_with_email, guest_without_email])
    db_session.commit()
    db_session.refresh(guest_with_email)
    db_session.refresh(guest_without_email)

    invite_with_email = Invite(
        code=f"PYTEST-COMMS-EMAIL-{uuid4().hex[:8].upper()}",
        wedding_id=TEST_WEDDING_ID,
        guest_id=guest_with_email.id,
        household_name="Pytest Comms Email Household",
        role="guest",
    )
    invite_without_email = Invite(
        code=f"PYTEST-COMMS-NOEMAIL-{uuid4().hex[:8].upper()}",
        wedding_id=TEST_WEDDING_ID,
        guest_id=guest_without_email.id,
        household_name="Pytest Comms No-Email Household",
        role="guest",
    )
    invite_no_guest = Invite(
        code=f"PYTEST-COMMS-NOGUEST-{uuid4().hex[:8].upper()}",
        wedding_id=TEST_WEDDING_ID,
        guest_id=None,
        household_name="Pytest Comms No-Guest Household",
        role="guest",
    )
    db_session.add_all([invite_with_email, invite_without_email, invite_no_guest])
    db_session.commit()
    for invite in (invite_with_email, invite_without_email, invite_no_guest):
        db_session.refresh(invite)

    invites = [invite_with_email, invite_without_email, invite_no_guest]
    try:
        yield invites
    finally:
        db_session.query(Invite).filter(
            Invite.id.in_([invite.id for invite in invites])
        ).delete(synchronize_session=False)
        db_session.query(Guest).filter(
            Guest.id.in_([guest_with_email.id, guest_without_email.id])
        ).delete(synchronize_session=False)
        db_session.commit()


class TestSendCommunicationEmailIntegration:
    """Integration coverage for the email side-effect of POST .../send."""

    def test_email_channel_sends_to_guests_with_email_only(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_communications: None,
        email_test_invites: list[Invite],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        settings = communications_module.get_settings()
        monkeypatch.setattr(settings, "resend_api_key", "test-resend-key")
        monkeypatch.setattr(
            communications_module,
            "audience_invites",
            lambda db, wedding_id, audience: email_test_invites,
        )

        captured: dict[str, object] = {}

        def fake_send_email_batch(
            recipients: list[tuple[str, str]], subject: str, html_body: str
        ) -> int:
            captured["recipients"] = recipients
            captured["subject"] = subject
            captured["html_body"] = html_body
            return len(recipients)

        monkeypatch.setattr(
            communications_module, "send_email_batch", fake_send_email_batch
        )

        created = coordinator_session.post(
            "/api/communications", json=communication_body()
        )
        assert created.status_code == 201
        communication_id = int(created.json()["id"])

        sent = coordinator_session.post(
            f"/api/communications/{communication_id}/send"
        )
        assert sent.status_code == 200
        assert sent.json()["status"] == "sent"

        # The only eligible recipient is the invite whose guest has an email.
        guest_with_email = email_test_invites[0].guest
        assert captured["recipients"] == [
            (guest_with_email.email, guest_with_email.name)
        ]

        # All three invites still get the unconditional in-app notification.
        notified_invite_ids = {
            row.recipient_invite_id
            for row in db_session.query(Notification)
            .filter(
                Notification.recipient_invite_id.in_(
                    [invite.id for invite in email_test_invites]
                )
            )
            .all()
        }
        assert notified_invite_ids == {invite.id for invite in email_test_invites}

    def test_email_channel_without_api_key_skips_sending(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_communications: None,
        email_test_invites: list[Invite],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        settings = communications_module.get_settings()
        monkeypatch.setattr(settings, "resend_api_key", None)
        monkeypatch.setattr(
            communications_module,
            "audience_invites",
            lambda db, wedding_id, audience: email_test_invites,
        )

        def fail_if_called(*args: object, **kwargs: object) -> int:
            raise AssertionError("send_email_batch must not be called without an API key")

        monkeypatch.setattr(
            communications_module, "send_email_batch", fail_if_called
        )

        created = coordinator_session.post(
            "/api/communications", json=communication_body()
        )
        assert created.status_code == 201
        communication_id = int(created.json()["id"])

        sent = coordinator_session.post(
            f"/api/communications/{communication_id}/send"
        )
        assert sent.status_code == 200
        assert sent.json()["status"] == "sent"

        notified_count = (
            db_session.query(Notification)
            .filter(
                Notification.recipient_invite_id.in_(
                    [invite.id for invite in email_test_invites]
                )
            )
            .count()
        )
        assert notified_count == len(email_test_invites)

    def test_resend_failure_does_not_fail_request_or_status(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_communications: None,
        email_test_invites: list[Invite],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        settings = communications_module.get_settings()
        monkeypatch.setattr(settings, "resend_api_key", "test-resend-key")
        monkeypatch.setattr(
            communications_module,
            "audience_invites",
            lambda db, wedding_id, audience: email_test_invites,
        )

        def boom(*args: object, **kwargs: object) -> int:
            raise RuntimeError("simulated Resend outage")

        monkeypatch.setattr(communications_module, "send_email_batch", boom)

        created = coordinator_session.post(
            "/api/communications", json=communication_body()
        )
        assert created.status_code == 201
        communication_id = int(created.json()["id"])

        sent = coordinator_session.post(
            f"/api/communications/{communication_id}/send"
        )
        assert sent.status_code == 200
        sent_data = sent.json()
        assert sent_data["status"] == "sent"
        assert sent_data["sent_at"] is not None

        db_session.expire_all()
        persisted = db_session.get(Communication, communication_id)
        assert persisted is not None
        assert persisted.status == "sent"
