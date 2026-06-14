import pytest
from datetime import date
from fastapi import status

from app.db.models import Task, TaskStatus, TaskPriority


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


@pytest.mark.usefixtures("authorized_client")
class TestTasksAPI:
    """Tests for tasks CRUD endpoints."""

    def test_list_tasks_requires_coordinator_role(self, client, coordinator_session):
        """Only coordinators and above can list tasks."""
        response = client.get("/api/tasks", cookies={"session": coordinator_session})
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)

    def test_list_tasks_guest_cannot_list(self, client, guest_session):
        """Guests cannot list tasks (requires coordinator role)."""
        response = client.get("/api/tasks", cookies={"session": guest_session})
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_task_requires_coordinator(self, client, coordinator_session, test_task_create_payload):
        """Coordinators can create tasks."""
        response = client.post(
            "/api/tasks",
            json=test_task_create_payload,
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["title"] == test_task_create_payload["title"]
        assert data["status"] == "not_started"
        assert data["priority"] == "high"

    def test_create_task_validates_title_required(self, client, coordinator_session):
        """Task title is required."""
        payload = {
            "wedding_id": 1,
            "title": "",  # Empty title
            "status": "not_started",
            "priority": "medium",
        }
        response = client.post(
            "/api/tasks",
            json=payload,
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_task_validates_status_enum(self, client, coordinator_session):
        """Task status must be valid enum value."""
        payload = {
            "wedding_id": 1,
            "title": "Valid title",
            "status": "invalid_status",
            "priority": "medium",
        }
        response = client.post(
            "/api/tasks",
            json=payload,
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_task_validates_priority_enum(self, client, coordinator_session):
        """Task priority must be valid enum value."""
        payload = {
            "wedding_id": 1,
            "title": "Valid title",
            "status": "not_started",
            "priority": "invalid_priority",
        }
        response = client.post(
            "/api/tasks",
            json=payload,
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_task_rejects_other_wedding(self, client, coordinator_session):
        """Coordinators cannot create tasks for other weddings."""
        payload = {
            "wedding_id": 999,  # Different wedding
            "title": "Task for other wedding",
            "status": "not_started",
            "priority": "medium",
        }
        response = client.post(
            "/api/tasks",
            json=payload,
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_task_requires_coordinator(self, client, coordinator_session, db):
        """Coordinators can get a specific task."""
        # Create a task first
        task = Task(
            wedding_id=1,
            title="Test task",
            status=TaskStatus.not_started,
            priority=TaskPriority.medium,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        response = client.get(
            f"/api/tasks/{task.id}",
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == task.id
        assert data["title"] == "Test task"

    def test_get_task_returns_404_when_not_found(self, client, coordinator_session):
        """Getting non-existent task returns 404."""
        response = client.get(
            "/api/tasks/99999",
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_task_requires_coordinator(self, client, coordinator_session, db):
        """Coordinators can update tasks."""
        task = Task(
            wedding_id=1,
            title="Original title",
            status=TaskStatus.not_started,
            priority=TaskPriority.medium,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        update_payload = {
            "title": "Updated title",
            "status": "in_progress",
            "priority": "high",
        }
        response = client.patch(
            f"/api/tasks/{task.id}",
            json=update_payload,
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["title"] == "Updated title"
        assert data["status"] == "in_progress"
        assert data["priority"] == "high"

    def test_update_task_partial_update(self, client, coordinator_session, db):
        """Partial updates only modify specified fields."""
        task = Task(
            wedding_id=1,
            title="Original",
            status=TaskStatus.not_started,
            priority=TaskPriority.medium,
            description="Original description",
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        # Only update title
        response = client.patch(
            f"/api/tasks/{task.id}",
            json={"title": "New title"},
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["title"] == "New title"
        assert data["description"] == "Original description"  # Unchanged

    def test_delete_task_requires_coordinator(self, client, coordinator_session, db):
        """Coordinators can delete tasks."""
        task = Task(
            wedding_id=1,
            title="Task to delete",
            status=TaskStatus.not_started,
            priority=TaskPriority.medium,
        )
        db.add(task)
        db.commit()
        task_id = task.id

        response = client.delete(
            f"/api/tasks/{task_id}",
            cookies={"session": coordinator_session},
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify task is deleted
        deleted_task = db.query(Task).filter(Task.id == task_id).first()
        assert deleted_task is None

    def test_delete_task_returns_404_when_not_found(self, client, coordinator_session):
        """Deleting non-existent task returns 404."""
        response = client.delete(
            "/api/tasks/99999",
            cookies={"session": coordinator_session},
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
