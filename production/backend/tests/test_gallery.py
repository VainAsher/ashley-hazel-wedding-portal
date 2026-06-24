from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import GalleryItem
from tests.fixtures.guests import TEST_WEDDING_ID


# A tiny but valid 1x1 PNG.
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f3b0000000049454e44ae42"
    "6082"
)


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
def cleanup_gallery(db_session: Session) -> Iterator[None]:
    yield
    db_session.query(GalleryItem).filter(
        GalleryItem.wedding_id == TEST_WEDDING_ID,
        GalleryItem.uploaded_by.like("Pytest%"),
    ).delete(synchronize_session=False)
    db_session.commit()


class TestGalleryIntegration:
    def test_full_gallery_lifecycle(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        created = coordinator_session.post(
            "/api/gallery",
            files={"file": ("t.png", TINY_PNG, "image/png")},
            data={"title": "Ceremony", "caption": "First look"},
        )
        assert created.status_code == 201
        data = created.json()
        item_id = int(data["id"])
        assert data["wedding_id"] == TEST_WEDDING_ID
        assert data["url"].startswith("/uploads/")
        assert data["url"] == f"/uploads/{data['file_path']}"
        assert data["status"] == "approved"
        assert data["content_type"] == "image/png"
        assert data["file_size"] == len(TINY_PNG)

        # The file should actually be on disk under the temp uploads dir.
        on_disk = uploads_dir / data["file_path"]
        assert on_disk.is_file()
        assert on_disk.read_bytes() == TINY_PNG

        listed = coordinator_session.get("/api/gallery")
        assert listed.status_code == 200
        assert item_id in {g["id"] for g in listed.json()}

        updated = coordinator_session.patch(
            f"/api/gallery/{item_id}",
            json={"status": "pending", "title": "Updated"},
        )
        assert updated.status_code == 200
        assert updated.json()["status"] == "pending"
        assert updated.json()["title"] == "Updated"

        db_session.expire_all()
        persisted = db_session.get(GalleryItem, item_id)
        assert persisted is not None
        assert persisted.status == "pending"

        deleted = coordinator_session.delete(f"/api/gallery/{item_id}")
        assert deleted.status_code == 200
        db_session.expire_all()
        assert db_session.get(GalleryItem, item_id) is None
        # File removed from disk too.
        assert not on_disk.exists()

    def test_non_image_rejected(
        self,
        coordinator_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/gallery",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
        assert response.status_code == 400

    def test_update_missing_returns_404(
        self, coordinator_session: TestClient, uploads_dir: Path
    ) -> None:
        response = coordinator_session.patch(
            "/api/gallery/999999", json={"status": "approved"}
        )
        assert response.status_code == 404

    def test_delete_missing_returns_404(
        self, coordinator_session: TestClient, uploads_dir: Path
    ) -> None:
        response = coordinator_session.delete("/api/gallery/999999")
        assert response.status_code == 404

    def test_invalid_status_rejected(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        created = coordinator_session.post(
            "/api/gallery",
            files={"file": ("t.png", TINY_PNG, "image/png")},
        )
        assert created.status_code == 201
        item_id = int(created.json()["id"])
        response = coordinator_session.patch(
            f"/api/gallery/{item_id}", json={"status": "bogus"}
        )
        assert response.status_code == 422

    def test_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/gallery").status_code == 401
        assert (
            client.post(
                "/api/gallery",
                files={"file": ("t.png", TINY_PNG, "image/png")},
            ).status_code
            == 401
        )
