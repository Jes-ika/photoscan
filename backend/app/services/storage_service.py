"""File storage service for event photos."""
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image


def get_storage_usage_bytes(base_dir: str = "uploads") -> int:
    """Return total bytes used in uploads directory."""
    base = Path(base_dir)
    if not base.exists():
        return 0
    total = 0
    for f in base.rglob("*"):
        if f.is_file():
            try:
                total += f.stat().st_size
            except OSError:
                pass
    return total


class StorageService:
    """Handles photo upload and storage."""

    def __init__(self, base_dir: str = "uploads"):
        self.base_dir = Path(base_dir)
        self.photos_dir = self.base_dir / "photos"
        self.thumbnails_dir = self.base_dir / "thumbnails"
        self.faces_dir = self.base_dir / "faces"
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in [self.photos_dir, self.thumbnails_dir, self.faces_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def get_usage_gb(self) -> float:
        """Storage used in GB."""
        return get_storage_usage_bytes(str(self.base_dir)) / (1024 ** 3)

    def can_upload(self, additional_bytes: int, limit_gb: float) -> Tuple[bool, str]:
        """Check if upload would exceed limit. Returns (allowed, message)."""
        used = get_storage_usage_bytes(str(self.base_dir))
        limit_bytes = int(limit_gb * 1024 ** 3)
        if used + additional_bytes > limit_bytes:
            return False, f"Storage limit reached ({limit_gb}GB). Used: {used/(1024**3):.2f}GB"
        return True, ""

    def save_photo(
        self,
        file_content: bytes,
        event_id: int,
        original_filename: str,
    ) -> tuple[str, Optional[str]]:
        """
        Save event photo and optionally create thumbnail.

        Returns:
            (relative_file_path, relative_thumbnail_path)
        """
        ext = Path(original_filename).suffix.lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
            ext = ".jpg"

        event_dir = self.photos_dir / str(event_id)
        event_dir.mkdir(parents=True, exist_ok=True)

        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = event_dir / unique_name
        file_path.write_bytes(file_content)

        # Create thumbnail (max 300px)
        thumb_path = None
        try:
            img = Image.open(file_path)
            img.thumbnail((300, 300))
            thumb_dir = self.thumbnails_dir / str(event_id)
            thumb_dir.mkdir(parents=True, exist_ok=True)
            thumb_file = thumb_dir / unique_name
            img.save(thumb_file, "JPEG", quality=85)
            thumb_path = str(thumb_file).replace("\\", "/")
        except Exception:
            pass

        rel_path = str(file_path).replace("\\", "/")
        if not rel_path.startswith("/"):
            rel_path = "/" + rel_path if not rel_path.startswith(self.base_dir.as_posix()) else rel_path
        # Store relative to base
        rel_photo = f"uploads/photos/{event_id}/{unique_name}"
        rel_thumb = f"uploads/thumbnails/{event_id}/{unique_name}" if thumb_path else None
        return rel_photo, rel_thumb

    def save_face_photo(self, file_content: bytes, user_id: int) -> str:
        """Save user face photo for profile."""
        ext = ".jpg"
        user_dir = self.faces_dir / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = user_dir / unique_name
        file_path.write_bytes(file_content)
        return f"uploads/faces/{user_id}/{unique_name}"

    def get_absolute_path(self, relative_path: str) -> Path:
        """Get absolute filesystem path from relative URL path."""
        # Normalize: might come as /uploads/... or uploads/...
        p = relative_path.lstrip("/")
        if not p.startswith("uploads"):
            p = f"uploads/{p}"
        return Path(p)

    def delete_photo(self, relative_path: str) -> bool:
        """Delete photo and its thumbnail if exists."""
        try:
            abs_path = self.get_absolute_path(relative_path)
            if abs_path.exists():
                abs_path.unlink()
                return True
            # Try thumbnail
            if "photos" in str(relative_path):
                thumb_path = str(relative_path).replace("photos", "thumbnails")
                t = self.get_absolute_path(thumb_path)
                if t.exists():
                    t.unlink()
            return True
        except Exception:
            return False
