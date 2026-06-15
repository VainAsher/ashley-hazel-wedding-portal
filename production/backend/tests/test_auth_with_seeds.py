"""
Example tests demonstrating how to use pre-seeded test invites.

These tests require the test database to be seeded with test data.
Run before testing:
  python -m scripts.seed_test_data

This module shows:
- How to login with DEMO-COUPLE, DEMO-COORDINATOR, DEMO-GUEST codes
- How to test different role authorizations
- How to work with authenticated clients
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.db.models import Guest, Invite
from app.main import app


@pytest.fixture()
def test_client() -> TestClient:
    """Create a test client."""
    return TestClient(app)


@pytest.fixture()
def db_session():
    """Get a database session for queries."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ============================================================================
# Authentication Tests with Seeded Invites
# ============================================================================


class TestAuthWithSeededData:
    """Test authentication using pre-seeded invite codes."""

    def test_login_with_demo_couple_code(self, test_client: TestClient):
        """Test that couple can login with DEMO-COUPLE code."""
        response = test_client.post(
            "/api/auth/login",
            json={"invite_code": "DEMO-COUPLE"}
        )

        assert response.status_code == 200
        # Depending on your auth implementation:
        # - Could be in session cookie
        # - Could be JWT token in response
        # - Could be session_id in response
        data = response.json()
        # Verify some auth data is returned
        assert data is not None

    def test_login_with_demo_coordinator_code(self, test_client: TestClient):
        """Test that coordinator can login with DEMO-COORDINATOR code."""
        response = test_client.post(
            "/api/auth/login",
            json={"invite_code": "DEMO-COORDINATOR"}
        )

        assert response.status_code == 200

    def test_login_with_demo_guest_code(self, test_client: TestClient):
        """Test that guest can login with DEMO-GUEST code."""
        response = test_client.post(
            "/api/auth/login",
            json={"invite_code": "DEMO-GUEST"}
        )

        assert response.status_code == 200

    def test_login_with_invalid_code_fails(self, test_client: TestClient):
        """Test that login fails with invalid code."""
        response = test_client.post(
            "/api/auth/login",
            json={"invite_code": "INVALID-CODE-12345"}
        )

        assert response.status_code in [401, 404]  # Unauthorized or Not Found


# ============================================================================
# Authorization Tests (Role-based Access)
# ============================================================================


class TestAuthorizationWithSeededData:
    """Test that different roles have appropriate access levels."""

    def test_coordinator_can_view_guests(self, test_client: TestClient):
        """Test that coordinator role can view all guests."""
        # Login as coordinator
        response = test_client.post(
            "/api/auth/login",
            json={"invite_code": "DEMO-COORDINATOR"}
        )
        assert response.status_code == 200

        # Should be able to view guests
        response = test_client.get("/api/guests")
        assert response.status_code == 200
        guests = response.json()
        assert isinstance(guests, list)
        # We seeded 5 guests
        assert len(guests) >= 5

    def test_guest_role_permissions(self, test_client: TestClient):
        """Test that guest role has limited permissions."""
        # Login as guest
        response = test_client.post(
            "/api/auth/login",
            json={"invite_code": "DEMO-GUEST"}
        )
        assert response.status_code == 200

        # Guest should have limited access
        # The exact behavior depends on your implementation:
        # - May only see their own record
        # - May only be able to update their own RSVP
        # - May not be able to create other guests
        # This is a placeholder - adjust based on your actual API

    def test_couple_can_manage_wedding(self, test_client: TestClient):
        """Test that couple role can manage wedding details."""
        # Login as couple
        response = test_client.post(
            "/api/auth/login",
            json={"invite_code": "DEMO-COUPLE"}
        )
        assert response.status_code == 200

        # Couple should have management permissions
        # Again, adjust based on your actual API


# ============================================================================
# Guest Data Tests
# ============================================================================


class TestGuestDataWithSeeds:
    """Test operations on seeded guest data."""

    def test_demo_guest_exists(self, db_session):
        """Test that the Demo Guest record exists."""
        guest = (
            db_session.query(Guest)
            .filter(
                Guest.wedding_id == 1,
                Guest.email == "demo-guest@example.com"
            )
            .first()
        )

        assert guest is not None
        assert guest.name == "Demo Guest"
        assert guest.email == "demo-guest@example.com"
        assert guest.rsvp_status == "pending"

    def test_additional_guests_exist(self, db_session):
        """Test that additional test guests were created."""
        guests = (
            db_session.query(Guest)
            .filter(Guest.wedding_id == 1)
            .all()
        )

        assert len(guests) >= 5

        guest_emails = {g.email for g in guests}
        expected_emails = {
            "demo-guest@example.com",
            "demo-guest-1@example.com",
            "demo-guest-2@example.com",
            "demo-guest-3@example.com",
            "demo-guest-4@example.com",
        }

        assert expected_emails.issubset(guest_emails)

    def test_demo_guest_invite_relationship(self, db_session):
        """Test that DEMO-GUEST invite is linked to Demo Guest."""
        invite = (
            db_session.query(Invite)
            .filter(
                Invite.wedding_id == 1,
                Invite.code == "DEMO-GUEST"
            )
            .first()
        )

        assert invite is not None
        assert invite.guest_id is not None
        assert invite.role == "guest"

        guest = invite.guest
        assert guest is not None
        assert guest.email == "demo-guest@example.com"

    def test_couple_invite_has_no_guest(self, db_session):
        """Test that DEMO-COUPLE invite is not linked to a guest."""
        invite = (
            db_session.query(Invite)
            .filter(
                Invite.wedding_id == 1,
                Invite.code == "DEMO-COUPLE"
            )
            .first()
        )

        assert invite is not None
        assert invite.role == "couple"
        assert invite.guest_id is None


# ============================================================================
# RSVP Tests (Example)
# ============================================================================


class TestRSVPWithSeededGuest:
    """Test RSVP functionality with seeded guest."""

    def test_guest_can_rsvp(self, test_client: TestClient):
        """Test that a guest can submit an RSVP."""
        # Login as guest
        response = test_client.post(
            "/api/auth/login",
            json={"invite_code": "DEMO-GUEST"}
        )
        assert response.status_code == 200

        # Submit RSVP (adjust endpoint based on your API)
        rsvp_data = {
            "status": "accepted",
            "meal_choice": "chicken",
            "dietary_restrictions": "vegetarian"
        }

        response = test_client.post(
            "/api/guests/rsvp",
            json=rsvp_data
        )

        # Should succeed (200) or redirect (302), depending on implementation
        assert response.status_code in [200, 302]


# ============================================================================
# Integration Tests
# ============================================================================


class TestAuthenticationFlow:
    """Test complete authentication flow with seeded data."""

    def test_full_authentication_flow(self, test_client: TestClient):
        """Test login -> access protected resource -> logout flow."""
        # 1. Login
        response = test_client.post(
            "/api/auth/login",
            json={"invite_code": "DEMO-COORDINATOR"}
        )
        assert response.status_code == 200

        # 2. Access protected resource
        response = test_client.get("/api/guests")
        assert response.status_code == 200

        # 3. Logout
        response = test_client.post("/api/auth/logout")
        assert response.status_code in [200, 302]  # Redirect or OK


# ============================================================================
# Fixture Examples
# ============================================================================


@pytest.fixture()
def authenticated_as_couple(test_client: TestClient) -> TestClient:
    """Return a client authenticated as couple."""
    test_client.post(
        "/api/auth/login",
        json={"invite_code": "DEMO-COUPLE"}
    )
    return test_client


@pytest.fixture()
def authenticated_as_coordinator(test_client: TestClient) -> TestClient:
    """Return a client authenticated as coordinator."""
    test_client.post(
        "/api/auth/login",
        json={"invite_code": "DEMO-COORDINATOR"}
    )
    return test_client


@pytest.fixture()
def authenticated_as_guest(test_client: TestClient) -> TestClient:
    """Return a client authenticated as guest."""
    test_client.post(
        "/api/auth/login",
        json={"invite_code": "DEMO-GUEST"}
    )
    return test_client


# Example usage:
# def test_coordinator_actions(authenticated_as_coordinator: TestClient):
#     response = authenticated_as_coordinator.get("/api/guests")
#     assert response.status_code == 200


# ============================================================================
# Notes on Test Data
# ============================================================================
"""
The seeded test data creates:

Wedding: Ashley & Hazel (ID: 1, Date: 2026-06-20)

Invite Codes:
  - DEMO-COUPLE (no guest association)
  - DEMO-COORDINATOR (no guest association)
  - DEMO-GUEST (linked to Demo Guest record)

Guests:
  1. Demo Guest (demo-guest@example.com)
  2. Alice Anderson (demo-guest-1@example.com)
  3. Bob Butler (demo-guest-2@example.com)
  4. Carol Chen (demo-guest-3@example.com)
  5. David Davis (demo-guest-4@example.com)

All guests have:
  - rsvp_status: 'pending' (can be changed by tests)
  - relationship: 'friend'
  - No RSVP details filled out

To use this test file:
  1. Seed database: python -m scripts.seed_test_data
  2. Verify seeds: python -m scripts.validate_test_seeds
  3. Run tests: pytest tests/test_auth_with_seeds.py -v

To customize:
  - Modify invite codes in seed_test_data.py
  - Add more guests by editing seed_test_data.py
  - Update role checks based on your implementation
"""
