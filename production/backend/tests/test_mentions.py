"""@mentions (Wave 3 item 16, closes the wave).

See docs/specs/MENTIONS.md for the full contract. Three things under test:
  - `extract_mentioned_invite_ids` as a pure function (no DB at all).
  - The mentions directory's scoping/authorization -- the privacy-critical
    part: a guest must never enumerate the full guest list, and a member of
    one party must never see another party's roster.
  - Notification fan-out from the three create endpoints (blessings, song
    dedications, party messages), including self-mention and out-of-scope
    exclusion.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Blessing, Guest, Invite, Notification, SongRequest, Wedding
from app.utils.mentions import extract_mentioned_invite_ids
from tests.fixtures.guests import TEST_WEDDING_ID, unique_guest_email


TEST_INVITE_PREFIX = "PYTEST-MENTIONS"


def unique_code(label: str) -> str:
    return f"{TEST_INVITE_PREFIX}-{label}-{uuid4().hex[:8].upper()}"


def make_guest_invite(
    db_session: Session,
    *,
    name: str,
    party: str | None = None,
    wedding_id: int = TEST_WEDDING_ID,
) -> Invite:
    guest = Guest(
        wedding_id=wedding_id,
        name=name,
        email=unique_guest_email("mentions"),
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
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def make_couple_invite(
    db_session: Session,
    *,
    partner_label: str | None = None,
    associated_party: str | None = None,
    household_name: str = "Pytest Mentions Couple Member",
    wedding_id: int = TEST_WEDDING_ID,
) -> Invite:
    invite = Invite(
        code=unique_code("COUPLE"),
        wedding_id=wedding_id,
        household_name=household_name,
        role="couple",
        partner_label=partner_label,
        associated_party=associated_party,
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def login(client: TestClient, invite: Invite) -> None:
    response = client.post("/api/auth/login", json={"invite_code": invite.code})
    assert response.status_code == 200


def mentions_for(db_session: Session, invite_id: int) -> list[Notification]:
    db_session.expire_all()
    return (
        db_session.query(Notification)
        .filter(
            Notification.recipient_invite_id == invite_id,
            Notification.kind == "mention",
        )
        .all()
    )


@pytest.fixture(autouse=True)
def cleanup_mentions_state(db_session: Session) -> Iterator[None]:
    def _purge() -> None:
        db_session.query(Blessing).filter(
            Blessing.author_name.like(f"{TEST_INVITE_PREFIX}%")
        ).delete(synchronize_session=False)
        db_session.query(SongRequest).filter(
            SongRequest.requested_by.like(f"{TEST_INVITE_PREFIX}%")
        ).delete(synchronize_session=False)
        # ON DELETE CASCADE takes care of any PartyMessage/Notification rows
        # addressed to or authored by these invites.
        db_session.query(Invite).filter(
            Invite.code.like(f"{TEST_INVITE_PREFIX}-%")
        ).delete(synchronize_session=False)
        db_session.query(Guest).filter(
            Guest.email.like("pytest-guest-mentions-%")
        ).delete(synchronize_session=False)
        db_session.commit()

    _purge()
    yield
    db_session.rollback()
    _purge()


@pytest.fixture()
def set_wedding_phase(db_session: Session) -> Iterator[Callable[[str], None]]:
    """Song requests are phase-gated for guests; force 'live' for the
    dedication fan-out tests regardless of the shared test DB's current
    phase, and restore it afterwards."""
    wedding = db_session.get(Wedding, TEST_WEDDING_ID)
    assert wedding is not None
    original = wedding.phase

    def _set(phase: str) -> None:
        db_session.expire_all()
        target = db_session.get(Wedding, TEST_WEDDING_ID)
        assert target is not None
        target.phase = phase
        db_session.commit()

    try:
        yield _set
    finally:
        db_session.expire_all()
        target = db_session.get(Wedding, TEST_WEDDING_ID)
        if target is not None:
            target.phase = original
            db_session.commit()


# ---------------------------------------------------------------------------
# extract_mentioned_invite_ids -- pure function, no DB.
# ---------------------------------------------------------------------------


class TestExtractMentionedInviteIds:
    def test_no_at_sign_is_no_match(self) -> None:
        directory = [(1, "Alex Smith")]
        assert extract_mentioned_invite_ids("Hello Alex Smith, congrats!", directory) == set()

    def test_empty_directory_is_no_match(self) -> None:
        assert extract_mentioned_invite_ids("Hello @Alex Smith", []) == set()

    def test_one_match(self) -> None:
        directory = [(1, "Alex Smith"), (2, "Jordan Lee")]
        assert extract_mentioned_invite_ids(
            "Great to see @Alex Smith here!", directory
        ) == {1}

    def test_multiple_matches(self) -> None:
        directory = [(1, "Alex Smith"), (2, "Jordan Lee")]
        text = "Big thanks to @Alex Smith and @Jordan Lee for everything!"
        assert extract_mentioned_invite_ids(text, directory) == {1, 2}

    def test_overlapping_prefix_names_pick_the_longest(self) -> None:
        directory = [(1, "Alex"), (2, "Alex Smith")]
        # "@Alex Smith ..." must match the longer "Alex Smith" (id 2), not
        # just the shorter "Alex" (id 1) that is also a valid prefix match.
        assert extract_mentioned_invite_ids("Cheers @Alex Smith!", directory) == {2}

    def test_shorter_name_still_matches_when_longer_one_is_absent(self) -> None:
        directory = [(1, "Alex")]
        assert extract_mentioned_invite_ids("Cheers @Alex, see you there!", directory) == {1}

    def test_case_insensitive(self) -> None:
        directory = [(1, "Alex Smith")]
        assert extract_mentioned_invite_ids("hey @ALEX SMITH!!", directory) == {1}

    def test_mention_of_name_not_in_directory_is_ignored(self) -> None:
        directory = [(1, "Alex Smith")]
        assert extract_mentioned_invite_ids("@Random Person, hi there", directory) == set()


# ---------------------------------------------------------------------------
# Mentions directory: scoping + authorization (the privacy-critical part).
# ---------------------------------------------------------------------------


class TestMentionsDirectoryScoping:
    def test_general_scope_includes_wedding_party_and_labelled_couple(
        self, client: TestClient, db_session: Session
    ) -> None:
        wp_member = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-WP Wendy", party="stag"
        )
        labelled_couple = make_couple_invite(
            db_session, partner_label=f"{TEST_INVITE_PREFIX}-Ashley"
        )
        requester = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Requester One")
        login(client, requester)

        response = client.get("/api/mentions/directory", params={"scope": "general"})
        assert response.status_code == 200
        by_id = {entry["invite_id"]: entry["display_name"] for entry in response.json()}
        assert by_id[wp_member.id] == f"{TEST_INVITE_PREFIX}-WP Wendy"
        assert by_id[labelled_couple.id] == f"{TEST_INVITE_PREFIX}-Ashley"

    def test_general_scope_excludes_plain_guest_and_unlabelled_couple(
        self, client: TestClient, db_session: Session
    ) -> None:
        plain_guest = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Plain Guest")
        unlabelled_couple = make_couple_invite(db_session, partner_label=None)
        requester = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Requester Two")
        login(client, requester)

        response = client.get("/api/mentions/directory", params={"scope": "general"})
        assert response.status_code == 200
        invite_ids = {entry["invite_id"] for entry in response.json()}
        assert plain_guest.id not in invite_ids
        assert unlabelled_couple.id not in invite_ids

    def test_party_scope_returns_only_that_partys_members(
        self, client: TestClient, db_session: Session
    ) -> None:
        stag_member = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Stag Steve", party="stag"
        )
        hen_member = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Hen Helen", party="hen"
        )
        login(client, stag_member)

        response = client.get("/api/mentions/directory", params={"scope": "stag"})
        assert response.status_code == 200
        invite_ids = {entry["invite_id"] for entry in response.json()}
        assert stag_member.id in invite_ids
        assert hen_member.id not in invite_ids

    def test_party_scope_403s_a_member_of_the_other_party(
        self, client: TestClient, db_session: Session
    ) -> None:
        hen_member = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Hen Only Holly", party="hen"
        )
        login(client, hen_member)
        response = client.get("/api/mentions/directory", params={"scope": "stag"})
        assert response.status_code == 403

    def test_party_scope_403s_a_guest_with_no_party(
        self, client: TestClient, db_session: Session
    ) -> None:
        plain_guest = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-No Party Nick")
        login(client, plain_guest)
        response = client.get("/api/mentions/directory", params={"scope": "hen"})
        assert response.status_code == 403

    def test_unauthenticated_is_401(self, client: TestClient) -> None:
        response = client.get("/api/mentions/directory", params={"scope": "general"})
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Blessing mention fan-out.
# ---------------------------------------------------------------------------


class TestBlessingMentionFanOut:
    def test_mention_of_eligible_member_creates_one_notification(
        self, client: TestClient, db_session: Session
    ) -> None:
        target = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Target Tara", party="stag"
        )
        author = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Author Andy")
        login(client, author)

        response = client.post(
            "/api/blessings",
            json={
                "author_name": f"{TEST_INVITE_PREFIX}-Author Andy",
                "message": f"Cheers to @{TEST_INVITE_PREFIX}-Target Tara for everything!",
            },
        )
        assert response.status_code == 201

        notifications = mentions_for(db_session, target.id)
        assert len(notifications) == 1
        notification = notifications[0]
        assert (
            notification.title
            == f"{TEST_INVITE_PREFIX}-Author Andy mentioned you in a blessing"
        )
        assert notification.link_path == "/blessings"
        assert notification.wedding_id == TEST_WEDDING_ID

    def test_mention_of_non_existent_name_creates_nothing(
        self, client: TestClient, db_session: Session
    ) -> None:
        target = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Not Mentioned Nora", party="stag"
        )
        author = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Author Betty")
        login(client, author)

        response = client.post(
            "/api/blessings",
            json={"author_name": None, "message": "Hi @Somebody Else, congrats!"},
        )
        assert response.status_code == 201
        assert mentions_for(db_session, target.id) == []

    def test_self_mention_creates_nothing(
        self, client: TestClient, db_session: Session
    ) -> None:
        author = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Self Sam", party="stag"
        )
        login(client, author)

        response = client.post(
            "/api/blessings",
            json={
                "author_name": f"{TEST_INVITE_PREFIX}-Self Sam",
                "message": f"Note to @{TEST_INVITE_PREFIX}-Self Sam: don't forget the rings!",
            },
        )
        assert response.status_code == 201
        assert mentions_for(db_session, author.id) == []

    def test_mention_of_out_of_scope_plain_guest_creates_nothing(
        self, client: TestClient, db_session: Session
    ) -> None:
        # A plain guest (no party, no couple role) is never in the
        # general-scope directory -- mentioning them by name does nothing.
        plain_guest = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Plain Priya")
        author = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Author Casey")
        login(client, author)

        response = client.post(
            "/api/blessings",
            json={
                "author_name": None,
                "message": f"Love you @{TEST_INVITE_PREFIX}-Plain Priya!",
            },
        )
        assert response.status_code == 201
        assert mentions_for(db_session, plain_guest.id) == []


# ---------------------------------------------------------------------------
# Song dedication mention fan-out.
# ---------------------------------------------------------------------------


class TestSongDedicationMentionFanOut:
    def test_dedication_mention_creates_notification(
        self,
        client: TestClient,
        db_session: Session,
        set_wedding_phase: Callable[[str], None],
    ) -> None:
        set_wedding_phase("live")
        target = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Dee Dedication", party="hen"
        )
        requester = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Requester Rae")
        login(client, requester)

        response = client.post(
            "/api/music/requests",
            json={
                "title": f"{TEST_INVITE_PREFIX} Test Song",
                "dedication": f"For @{TEST_INVITE_PREFIX}-Dee Dedication, love you!",
            },
        )
        assert response.status_code == 201

        notifications = mentions_for(db_session, target.id)
        assert len(notifications) == 1
        assert (
            notifications[0].title
            == f"{TEST_INVITE_PREFIX}-Requester Rae mentioned you in a song dedication"
        )
        assert notifications[0].link_path == "/music"

    def test_title_and_artist_are_never_scanned_for_mentions(
        self,
        client: TestClient,
        db_session: Session,
        set_wedding_phase: Callable[[str], None],
    ) -> None:
        set_wedding_phase("live")
        target = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Not Scanned Nora", party="hen"
        )
        requester = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Requester Remy")
        login(client, requester)

        response = client.post(
            "/api/music/requests",
            json={
                "title": f"@{TEST_INVITE_PREFIX}-Not Scanned Nora's Song",
                "artist": f"@{TEST_INVITE_PREFIX}-Not Scanned Nora",
            },
        )
        assert response.status_code == 201
        assert mentions_for(db_session, target.id) == []

    def test_no_dedication_creates_nothing(
        self,
        client: TestClient,
        db_session: Session,
        set_wedding_phase: Callable[[str], None],
    ) -> None:
        set_wedding_phase("live")
        target = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Untouched Uma", party="hen"
        )
        requester = make_guest_invite(db_session, name=f"{TEST_INVITE_PREFIX}-Requester Rio")
        login(client, requester)

        response = client.post(
            "/api/music/requests",
            json={"title": f"{TEST_INVITE_PREFIX} No Dedication Song"},
        )
        assert response.status_code == 201
        assert mentions_for(db_session, target.id) == []


# ---------------------------------------------------------------------------
# Party message mention fan-out (scoped to that party -- no cross-context
# mentions, per docs/specs/MENTIONS.md's "Explicitly out of scope").
# ---------------------------------------------------------------------------


class TestPartyMessageMentionFanOut:
    def test_mention_of_fellow_party_member_creates_notification(
        self, client: TestClient, db_session: Session
    ) -> None:
        target = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Stag Target Tom", party="stag"
        )
        author = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Stag Author Alan", party="stag"
        )
        login(client, author)

        response = client.post(
            "/api/party/stag/messages",
            json={"message": f"Legendary night, @{TEST_INVITE_PREFIX}-Stag Target Tom!"},
        )
        assert response.status_code == 201

        notifications = mentions_for(db_session, target.id)
        assert len(notifications) == 1
        assert (
            notifications[0].title
            == f"{TEST_INVITE_PREFIX}-Stag Author Alan mentioned you in a Stag Do message"
        )
        assert notifications[0].link_path == "/party/stag"

    def test_mention_of_other_partys_member_creates_nothing(
        self, client: TestClient, db_session: Session
    ) -> None:
        # No cross-context mentions: a Hen member's name mentioned from the
        # Stag board matches nothing, since the fan-out directory is scoped
        # to the posting party only.
        hen_member = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Hen Bystander Beth", party="hen"
        )
        stag_author = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Stag Author Owen", party="stag"
        )
        login(client, stag_author)

        response = client.post(
            "/api/party/stag/messages",
            json={"message": f"Shoutout to @{TEST_INVITE_PREFIX}-Hen Bystander Beth!"},
        )
        assert response.status_code == 201
        assert mentions_for(db_session, hen_member.id) == []

    def test_self_mention_creates_nothing(
        self, client: TestClient, db_session: Session
    ) -> None:
        author = make_guest_invite(
            db_session, name=f"{TEST_INVITE_PREFIX}-Stag Self Sean", party="stag"
        )
        login(client, author)

        response = client.post(
            "/api/party/stag/messages",
            json={"message": f"@{TEST_INVITE_PREFIX}-Stag Self Sean is hyped for this!"},
        )
        assert response.status_code == 201
        assert mentions_for(db_session, author.id) == []
