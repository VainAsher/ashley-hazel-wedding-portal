from __future__ import annotations

from collections.abc import Iterator
from uuid import uuid4

import pytest
from datetime import date
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.models import Task, Wedding
from tests.fixtures.guests import TEST_WEDDING_ID


@pytest.fixture
def test_task_create_payload():
    return {
        "wedding_id": 1,
        "title": "Send save-the-dates",
        "description": "Email all guests with wedding details",
        "status": "not_started",
        "priority": "high",
        "due_date": None,
        "assigned_to": None,
        "category": "invitations",
    }


def create_task(coordinator_session: TestClient, **overrides: object) -> dict:
    payload = {
        "wedding_id": TEST_WEDDING_ID,
        "title": "Pytest task",
        "status": "not_started",
        "priority": "medium",
        **overrides,
    }
    response = coordinator_session.post("/api/tasks", json=payload)
    assert response.status_code == status.HTTP_201_CREATED, response.text
    return response.json()


class TestTasksAPI:
    """Tests for tasks CRUD endpoints."""

    def test_list_tasks_requires_coordinator_role(self, coordinator_session):
        """Only coordinators and above can list tasks."""
        response = coordinator_session.get("/api/tasks")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)

    def test_list_tasks_guest_cannot_list(self, guest_session):
        """Guests cannot list tasks (requires coordinator role)."""
        response = guest_session.get("/api/tasks")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_task_requires_coordinator(self, coordinator_session, test_task_create_payload):
        """Coordinators can create tasks."""
        response = coordinator_session.post(
            "/api/tasks",
            json=test_task_create_payload,
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["title"] == test_task_create_payload["title"]
        assert data["status"] == "not_started"
        assert data["priority"] == "high"

    def test_create_task_validates_title_required(self, coordinator_session):
        """Task title is required."""
        payload = {
            "wedding_id": 1,
            "title": "",  # Empty title
            "status": "not_started",
            "priority": "medium",
        }
        response = coordinator_session.post(
            "/api/tasks",
            json=payload,
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_task_validates_status_enum(self, coordinator_session):
        """Task status must be valid enum value."""
        payload = {
            "wedding_id": 1,
            "title": "Valid title",
            "status": "invalid_status",
            "priority": "medium",
        }
        response = coordinator_session.post(
            "/api/tasks",
            json=payload,
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_task_validates_priority_enum(self, coordinator_session):
        """Task priority must be valid enum value."""
        payload = {
            "wedding_id": 1,
            "title": "Valid title",
            "status": "not_started",
            "priority": "invalid_priority",
        }
        response = coordinator_session.post(
            "/api/tasks",
            json=payload,
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_task_rejects_other_wedding(self, coordinator_session):
        """Coordinators cannot create tasks for other weddings."""
        payload = {
            "wedding_id": 999,  # Different wedding
            "title": "Task for other wedding",
            "status": "not_started",
            "priority": "medium",
        }
        response = coordinator_session.post(
            "/api/tasks",
            json=payload,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_task_requires_coordinator(self, coordinator_session):
        """Coordinators can get a specific task."""
        # Create a task via API
        payload = {
            "wedding_id": 1,
            "title": "Test task",
            "status": "not_started",
            "priority": "medium",
        }
        create_response = coordinator_session.post("/api/tasks", json=payload)
        assert create_response.status_code == status.HTTP_201_CREATED
        task_id = create_response.json()["id"]

        response = coordinator_session.get(
            f"/api/tasks/{task_id}",
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == task_id
        assert data["title"] == "Test task"

    def test_get_task_returns_404_when_not_found(self, coordinator_session):
        """Getting non-existent task returns 404."""
        response = coordinator_session.get(
            "/api/tasks/99999",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_task_requires_coordinator(self, coordinator_session):
        """Coordinators can update tasks."""
        # Create a task via API first
        create_payload = {
            "wedding_id": 1,
            "title": "Original title",
            "status": "not_started",
            "priority": "medium",
        }
        create_response = coordinator_session.post("/api/tasks", json=create_payload)
        assert create_response.status_code == status.HTTP_201_CREATED
        task_id = create_response.json()["id"]

        update_payload = {
            "title": "Updated title",
            "status": "in_progress",
            "priority": "high",
        }
        response = coordinator_session.patch(
            f"/api/tasks/{task_id}",
            json=update_payload,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["title"] == "Updated title"
        assert data["status"] == "in_progress"
        assert data["priority"] == "high"

    def test_update_task_partial_update(self, coordinator_session):
        """Partial updates only modify specified fields."""
        # Create a task via API first
        create_payload = {
            "wedding_id": 1,
            "title": "Original",
            "status": "not_started",
            "priority": "medium",
            "description": "Original description",
        }
        create_response = coordinator_session.post("/api/tasks", json=create_payload)
        assert create_response.status_code == status.HTTP_201_CREATED
        task_id = create_response.json()["id"]

        # Only update title
        response = coordinator_session.patch(
            f"/api/tasks/{task_id}",
            json={"title": "New title"},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["title"] == "New title"
        assert data["description"] == "Original description"  # Unchanged

    def test_update_task_with_due_date(self, coordinator_session):
        """Editing a task with a YYYY-MM-DD due date must not 422.

        Regression: TaskUpdate.due_date was typed datetime while the edit
        form (and TaskCreate) send a plain date string, so every edit of a
        task that had a due date was rejected.
        """
        create_payload = {
            "wedding_id": 1,
            "title": "Book florist",
            "status": "not_started",
            "priority": "medium",
            "due_date": "2026-08-21",
        }
        create_response = coordinator_session.post("/api/tasks", json=create_payload)
        assert create_response.status_code == status.HTTP_201_CREATED
        task_id = create_response.json()["id"]

        # The edit dialog sends the full form, due date included.
        update_payload = {
            "title": "Book florist",
            "description": "Deposit paid",
            "status": "in_progress",
            "priority": "medium",
            "due_date": "2026-08-15",
            "assigned_to": None,
        }
        response = coordinator_session.patch(f"/api/tasks/{task_id}", json=update_payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["due_date"] == "2026-08-15"
        assert data["description"] == "Deposit paid"

    def test_delete_task_requires_coordinator(self, coordinator_session):
        """Coordinators can delete tasks."""
        # Create a task via API first
        create_payload = {
            "wedding_id": 1,
            "title": "Task to delete",
            "status": "not_started",
            "priority": "medium",
        }
        create_response = coordinator_session.post("/api/tasks", json=create_payload)
        assert create_response.status_code == status.HTTP_201_CREATED
        task_id = create_response.json()["id"]

        response = coordinator_session.delete(
            f"/api/tasks/{task_id}",
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify task is deleted
        get_response = coordinator_session.get(f"/api/tasks/{task_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_task_returns_404_when_not_found(self, coordinator_session):
        """Deleting non-existent task returns 404."""
        response = coordinator_session.delete(
            "/api/tasks/99999",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_cannot_access_tasks(self, client):
        """Unauthenticated requests are rejected."""
        response = client.get("/api/tasks")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        response = client.post(
            "/api/tasks",
            json={
                "wedding_id": 1,
                "title": "Test",
                "status": "not_started",
                "priority": "medium",
            },
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestTaskContext:
    """Kanban V2: tasks gain a `context` (wedding/stag/hen), the admin
    Timeline always uses `wedding`, and `?context=` filters the list."""

    def test_create_task_defaults_to_wedding_context(self, coordinator_session):
        task = create_task(coordinator_session, title=f"Pytest ctx default {uuid4().hex[:6]}")
        assert task["context"] == "wedding"

    def test_create_task_with_stag_context(self, coordinator_session):
        task = create_task(
            coordinator_session,
            title=f"Pytest ctx stag {uuid4().hex[:6]}",
            context="stag",
        )
        assert task["context"] == "stag"

    def test_create_task_rejects_invalid_context(self, coordinator_session):
        payload = {
            "wedding_id": TEST_WEDDING_ID,
            "title": "Bad context",
            "status": "not_started",
            "priority": "medium",
            "context": "bachelorette",
        }
        response = coordinator_session.post("/api/tasks", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_list_tasks_filters_by_context(self, coordinator_session):
        wedding_title = f"Pytest ctx-list wedding {uuid4().hex[:6]}"
        stag_title = f"Pytest ctx-list stag {uuid4().hex[:6]}"
        create_task(coordinator_session, title=wedding_title, context="wedding")
        create_task(coordinator_session, title=stag_title, context="stag")

        wedding_titles = {t["title"] for t in coordinator_session.get("/api/tasks").json()}
        assert wedding_title in wedding_titles
        assert stag_title not in wedding_titles

        stag_titles = {
            t["title"] for t in coordinator_session.get("/api/tasks?context=stag").json()
        }
        assert stag_title in stag_titles
        assert wedding_title not in stag_titles

    def test_list_tasks_rejects_invalid_context(self, coordinator_session):
        response = coordinator_session.get("/api/tasks?context=bachelorette")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestTaskMove:
    """PATCH /api/tasks/{id}/move — drag-and-drop reorder/move semantics."""

    def _positions_by_title(self, coordinator_session, titles: set[str]) -> dict:
        tasks = coordinator_session.get("/api/tasks").json()
        return {t["title"]: (t["status"], t["position"]) for t in tasks if t["title"] in titles}

    def test_move_mid_column_insert_resequences_neighbours(self, coordinator_session):
        a = create_task(coordinator_session, title=f"Pytest move A {uuid4().hex[:6]}")
        b = create_task(coordinator_session, title=f"Pytest move B {uuid4().hex[:6]}")
        c = create_task(coordinator_session, title=f"Pytest move C {uuid4().hex[:6]}")

        response = coordinator_session.patch(
            f"/api/tasks/{c['id']}/move",
            json={"status": "not_started", "position": 0},
        )
        assert response.status_code == status.HTTP_200_OK

        by_title = self._positions_by_title(
            coordinator_session, {a["title"], b["title"], c["title"]}
        )
        ordered = sorted(by_title.items(), key=lambda item: item[1][1])
        assert [title for title, _ in ordered] == [c["title"], a["title"], b["title"]]

    def test_move_cross_column_inserts_at_position(self, coordinator_session):
        existing = create_task(
            coordinator_session, title=f"Pytest move existing {uuid4().hex[:6]}", status="in_progress"
        )
        mover = create_task(
            coordinator_session, title=f"Pytest move mover {uuid4().hex[:6]}", status="not_started"
        )

        response = coordinator_session.patch(
            f"/api/tasks/{mover['id']}/move",
            json={"status": "in_progress", "position": 0},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "in_progress"

        by_title = self._positions_by_title(
            coordinator_session, {existing["title"], mover["title"]}
        )
        assert by_title[mover["title"]][0] == "in_progress"
        assert by_title[mover["title"]][1] < by_title[existing["title"]][1]

    def test_move_oversized_position_clamps_to_append(self, coordinator_session):
        g = create_task(coordinator_session, title=f"Pytest move G {uuid4().hex[:6]}", status="done")
        h = create_task(coordinator_session, title=f"Pytest move H {uuid4().hex[:6]}", status="done")

        response = coordinator_session.patch(
            f"/api/tasks/{g['id']}/move",
            json={"status": "done", "position": 999999},
        )
        assert response.status_code == status.HTTP_200_OK

        by_title = self._positions_by_title(coordinator_session, {g["title"], h["title"]})
        ordered = sorted(by_title.items(), key=lambda item: item[1][1])
        assert [title for title, _ in ordered] == [h["title"], g["title"]]

    def test_move_new_card_appends_to_end(self, coordinator_session):
        """New cards append to the end of their column (not a random slot)."""
        first = create_task(
            coordinator_session, title=f"Pytest append first {uuid4().hex[:6]}", status="blocked"
        )
        second = create_task(
            coordinator_session, title=f"Pytest append second {uuid4().hex[:6]}", status="blocked"
        )
        assert second["position"] > first["position"]

    def test_move_rejects_invalid_status(self, coordinator_session):
        task = create_task(coordinator_session, title=f"Pytest move invalid status {uuid4().hex[:6]}")
        response = coordinator_session.patch(
            f"/api/tasks/{task['id']}/move",
            json={"status": "archived", "position": 0},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_move_rejects_negative_position(self, coordinator_session):
        task = create_task(coordinator_session, title=f"Pytest move negative {uuid4().hex[:6]}")
        response = coordinator_session.patch(
            f"/api/tasks/{task['id']}/move",
            json={"status": "not_started", "position": -1},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_move_unknown_task_returns_404(self, coordinator_session):
        response = coordinator_session.patch(
            "/api/tasks/999999/move",
            json={"status": "not_started", "position": 0},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestTaskMoveCrossWedding:
    @pytest.fixture()
    def other_wedding_task(self, db_session: Session) -> Iterator[Task]:
        """A task belonging to a different wedding than the session's."""
        other_wedding = Wedding(
            couple_names="Pytest Other Couple (move)",
            wedding_date=date(2030, 1, 1),
        )
        db_session.add(other_wedding)
        db_session.commit()
        task = Task(
            wedding_id=other_wedding.id,
            title="Pytest cross-wedding move target",
            status="not_started",
            priority="medium",
            context="wedding",
            position=0,
        )
        db_session.add(task)
        db_session.commit()
        db_session.refresh(task)
        try:
            yield task
        finally:
            db_session.delete(task)
            db_session.delete(other_wedding)
            db_session.commit()

    def test_move_other_weddings_task_is_404(
        self, coordinator_session: TestClient, other_wedding_task: Task
    ) -> None:
        response = coordinator_session.patch(
            f"/api/tasks/{other_wedding_task.id}/move",
            json={"status": "done", "position": 0},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestPositionBackfill:
    """Migration 020 backfills `position` per (wedding_id, status) ordered by
    created_at. Regression-guard the backfill query's ordering semantics
    directly (it only ever runs once in production, on real pre-v2 rows)."""

    def test_backfill_orders_rows_by_created_at_per_column(self, db_session: Session) -> None:
        titles = [f"Pytest backfill {i} {uuid4().hex[:6]}" for i in range(3)]
        for offset, title in enumerate(titles):
            db_session.execute(
                text(
                    """
                    INSERT INTO tasks
                        (wedding_id, title, status, priority, context, position, created_at)
                    VALUES
                        (:wedding_id, :title, 'not_started', 'medium', 'wedding', NULL,
                         CURRENT_TIMESTAMP + make_interval(secs => :offset))
                    """
                ),
                {"wedding_id": TEST_WEDDING_ID, "title": title, "offset": offset},
            )
        db_session.commit()

        db_session.execute(
            text(
                """
                WITH ranked AS (
                  SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY wedding_id, status ORDER BY created_at, id
                  ) - 1 AS rn
                  FROM tasks
                  WHERE position IS NULL
                )
                UPDATE tasks
                SET position = ranked.rn
                FROM ranked
                WHERE tasks.id = ranked.id
                """
            )
        )
        db_session.commit()

        rows = (
            db_session.query(Task)
            .filter(Task.title.in_(titles))
            .order_by(Task.position.asc())
            .all()
        )
        try:
            assert [row.title for row in rows] == titles
            assert [row.position for row in rows] == list(range(len(titles)))
        finally:
            for row in rows:
                db_session.delete(row)
            db_session.commit()
