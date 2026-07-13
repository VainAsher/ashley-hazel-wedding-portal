from __future__ import annotations

import io
import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.db.models import GalleryItem
from tests.fixtures.guests import TEST_WEDDING_ID


# A tiny but valid 1x1 PNG.
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f3b0000000049454e44ae42"
    "6082"
)

# EXIF orientation tag: 6 = rotated 90 degrees clockwise.
EXIF_ORIENTATION = 0x0112

# App-level size cap, mirrored from app/api/gallery.py (150MB).
MAX_UPLOAD_BYTES = 150 * 1024 * 1024


def make_mp4_bytes(size: int = 2048) -> bytes:
    """A tiny fake .mp4 payload.

    Not a real playable video — save_upload() validates via the multipart
    Content-Type header, not by sniffing file contents, so arbitrary bytes
    with a recognizable ftyp box prefix are enough to exercise the
    content-type/size-cap code paths.
    """
    ftyp_box = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"
    padding = b"\x00" * max(0, size - len(ftyp_box))
    return ftyp_box + padding


def make_image_bytes(
    image_format: str = "JPEG",
    size: tuple[int, int] = (1200, 800),
    orientation: int | None = None,
) -> bytes:
    """Generate a small in-memory test image."""
    image = Image.new("RGB", size, "#b76e79")
    buffer = io.BytesIO()
    if orientation is None:
        image.save(buffer, image_format)
    else:
        exif = Image.Exif()
        exif[EXIF_ORIENTATION] = orientation
        image.save(buffer, image_format, exif=exif)
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


class TestGalleryThumbnails:
    def test_upload_generates_thumbnail(
        self,
        coordinator_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        created = coordinator_session.post(
            "/api/gallery",
            files={"file": ("big.jpg", make_image_bytes(), "image/jpeg")},
        )
        assert created.status_code == 201
        data = created.json()
        expected_thumb = f"{TEST_WEDDING_ID}/thumbs/{Path(data['file_path']).stem}.jpg"
        assert data["thumb_path"] == expected_thumb
        assert data["thumb_url"] == f"/uploads/{expected_thumb}"

        # A real ~480px-wide JPEG derivative lands on disk.
        thumb_on_disk = uploads_dir / expected_thumb
        assert thumb_on_disk.is_file()
        with Image.open(thumb_on_disk) as thumb:
            assert thumb.format == "JPEG"
            assert (thumb.width, thumb.height) == (480, 320)

        # Deleting the item removes the thumbnail alongside the original.
        original_on_disk = uploads_dir / data["file_path"]
        assert original_on_disk.is_file()
        deleted = coordinator_session.delete(f"/api/gallery/{data['id']}")
        assert deleted.status_code == 200
        assert not original_on_disk.exists()
        assert not thumb_on_disk.exists()

    def test_thumbnail_respects_exif_orientation(
        self,
        coordinator_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        # Orientation 6 turns the 1200x800 source into a portrait image.
        created = coordinator_session.post(
            "/api/gallery",
            files={
                "file": (
                    "rotated.jpg",
                    make_image_bytes(orientation=6),
                    "image/jpeg",
                )
            },
        )
        assert created.status_code == 201
        data = created.json()
        assert data["thumb_path"] is not None
        with Image.open(uploads_dir / data["thumb_path"]) as thumb:
            assert (thumb.width, thumb.height) == (480, 720)

    def test_unsupported_format_uploads_without_thumbnail(
        self,
        coordinator_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        created = coordinator_session.post(
            "/api/gallery",
            files={
                "file": (
                    "anim.gif",
                    make_image_bytes(image_format="GIF", size=(20, 20)),
                    "image/gif",
                )
            },
        )
        assert created.status_code == 201
        data = created.json()
        assert data["thumb_path"] is None
        assert data["thumb_url"] is None
        assert (uploads_dir / data["file_path"]).is_file()

    def test_corrupt_image_uploads_without_thumbnail(
        self,
        coordinator_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        created = coordinator_session.post(
            "/api/gallery",
            files={"file": ("broken.png", b"not-a-real-png", "image/png")},
        )
        assert created.status_code == 201
        data = created.json()
        assert data["thumb_path"] is None
        assert data["thumb_url"] is None
        assert (uploads_dir / data["file_path"]).is_file()

    def test_backfill_generates_missing_thumbs(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        wedding_dir = uploads_dir / str(TEST_WEDDING_ID)
        wedding_dir.mkdir(parents=True, exist_ok=True)
        (wedding_dir / "pytest-backfill.jpg").write_bytes(make_image_bytes())
        (wedding_dir / "pytest-backfill.gif").write_bytes(
            make_image_bytes(image_format="GIF", size=(20, 20))
        )

        on_disk = GalleryItem(
            wedding_id=TEST_WEDDING_ID,
            title="Needs thumb",
            file_path=f"{TEST_WEDDING_ID}/pytest-backfill.jpg",
            content_type="image/jpeg",
            uploaded_by="Pytest Backfill",
            status="approved",
        )
        missing_file = GalleryItem(
            wedding_id=TEST_WEDDING_ID,
            title="Original gone",
            file_path=f"{TEST_WEDDING_ID}/pytest-vanished.jpg",
            content_type="image/jpeg",
            uploaded_by="Pytest Backfill",
            status="approved",
        )
        unsupported = GalleryItem(
            wedding_id=TEST_WEDDING_ID,
            title="Unsupported format",
            file_path=f"{TEST_WEDDING_ID}/pytest-backfill.gif",
            content_type="image/gif",
            uploaded_by="Pytest Backfill",
            status="approved",
        )
        db_session.add_all([on_disk, missing_file, unsupported])
        db_session.commit()

        response = coordinator_session.post("/api/gallery/thumbnails/backfill")
        assert response.status_code == 200
        data = response.json()
        # Only our on-disk JPEG is generatable; the missing original and the
        # GIF are skipped (alongside any other thumbless rows in the shared DB).
        assert data["generated"] == 1
        assert data["skipped"] >= 2

        db_session.expire_all()
        assert on_disk.thumb_path == f"{TEST_WEDDING_ID}/thumbs/pytest-backfill.jpg"
        assert (uploads_dir / on_disk.thumb_path).is_file()
        assert missing_file.thumb_path is None
        assert unsupported.thumb_path is None

    def test_backfill_requires_coordinator(self, guest_session: TestClient) -> None:
        response = guest_session.post("/api/gallery/thumbnails/backfill")
        assert response.status_code == 403

    def test_backfill_requires_authentication(self, client: TestClient) -> None:
        assert client.post("/api/gallery/thumbnails/backfill").status_code == 401


class TestGuestGallery:
    def test_guest_can_submit_photo(
        self,
        guest_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        response = guest_session.post(
            "/api/gallery/submit",
            files={"file": ("t.png", TINY_PNG, "image/png")},
            data={"title": "Our table", "caption": "Reception"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "pending"
        assert data["wedding_id"] == TEST_WEDDING_ID
        assert data["title"] == "Our table"
        assert data["url"] == f"/uploads/{data['file_path']}"

        # File is actually persisted under the temp uploads dir.
        on_disk = uploads_dir / data["file_path"]
        assert on_disk.is_file()
        assert on_disk.read_bytes() == TINY_PNG

    def test_submit_non_image_rejected(
        self,
        guest_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        response = guest_session.post(
            "/api/gallery/submit",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
        assert response.status_code == 400

    def test_approved_returns_only_approved(
        self,
        guest_session: TestClient,
        db_session: Session,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        approved = GalleryItem(
            wedding_id=TEST_WEDDING_ID,
            title="Approved shot",
            file_path=f"{TEST_WEDDING_ID}/approved.png",
            content_type="image/png",
            file_size=len(TINY_PNG),
            uploaded_by="Pytest Guest",
            status="approved",
        )
        pending = GalleryItem(
            wedding_id=TEST_WEDDING_ID,
            title="Pending shot",
            file_path=f"{TEST_WEDDING_ID}/pending.png",
            content_type="image/png",
            file_size=len(TINY_PNG),
            uploaded_by="Pytest Guest",
            status="pending",
        )
        db_session.add_all([approved, pending])
        db_session.commit()
        db_session.refresh(approved)
        db_session.refresh(pending)

        response = guest_session.get("/api/gallery/approved")
        assert response.status_code == 200
        returned = {item["id"]: item for item in response.json()}
        assert approved.id in returned
        assert pending.id not in returned
        assert all(item["status"] == "approved" for item in returned.values())

    def test_submit_requires_authentication(self, client: TestClient) -> None:
        assert (
            client.post(
                "/api/gallery/submit",
                files={"file": ("t.png", TINY_PNG, "image/png")},
            ).status_code
            == 401
        )


class TestGalleryVideo:
    """Direct .mp4 video upload (Wave 4 item 19, docs/specs/VIDEO_UPLOAD.md)."""

    def test_coordinator_upload_video_approved(
        self,
        coordinator_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        video_bytes = make_mp4_bytes()
        created = coordinator_session.post(
            "/api/gallery",
            files={"file": ("clip.mp4", video_bytes, "video/mp4")},
            data={"title": "First dance", "caption": "Reception"},
        )
        assert created.status_code == 201
        data = created.json()
        assert data["content_type"] == "video/mp4"
        assert data["file_size"] == len(video_bytes)
        assert data["status"] == "approved"
        # No thumbnail for video — same shape as an unsupported image format,
        # otherwise identical to an image row.
        assert data["thumb_path"] is None
        assert data["thumb_url"] is None
        assert data["url"] == f"/uploads/{data['file_path']}"

        on_disk = uploads_dir / data["file_path"]
        assert on_disk.is_file()
        assert on_disk.read_bytes() == video_bytes

    def test_guest_submit_video_pending(
        self,
        guest_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        video_bytes = make_mp4_bytes()
        response = guest_session.post(
            "/api/gallery/submit",
            files={"file": ("clip.mp4", video_bytes, "video/mp4")},
            data={"title": "Guest clip"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "pending"
        assert data["content_type"] == "video/mp4"
        assert data["thumb_path"] is None
        assert data["thumb_url"] is None

        on_disk = uploads_dir / data["file_path"]
        assert on_disk.is_file()
        assert on_disk.read_bytes() == video_bytes

    def test_non_mp4_video_rejected(
        self,
        coordinator_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/gallery",
            files={"file": ("clip.mov", make_mp4_bytes(), "video/quicktime")},
        )
        assert response.status_code == 400

    def test_webm_video_rejected(
        self,
        coordinator_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/gallery",
            files={"file": ("clip.webm", make_mp4_bytes(), "video/webm")},
        )
        assert response.status_code == 400

    def test_over_cap_video_rejected_with_413(
        self,
        coordinator_session: TestClient,
        uploads_dir: Path,
        cleanup_gallery: None,
    ) -> None:
        oversized = make_mp4_bytes(MAX_UPLOAD_BYTES + 1024)
        response = coordinator_session.post(
            "/api/gallery",
            files={"file": ("huge.mp4", oversized, "video/mp4")},
        )
        assert response.status_code == 413
        # Nothing should have been written to disk for a rejected upload.
        wedding_dir = uploads_dir / str(TEST_WEDDING_ID)
        leftover_files = list(wedding_dir.glob("*.mp4")) if wedding_dir.exists() else []
        assert leftover_files == []

    def test_video_submit_requires_authentication(self, client: TestClient) -> None:
        assert (
            client.post(
                "/api/gallery/submit",
                files={"file": ("clip.mp4", make_mp4_bytes(), "video/mp4")},
            ).status_code
            == 401
        )
