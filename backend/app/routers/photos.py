"""Photo upload and processing API endpoints."""
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Event, EventPhoto, EventStatus, UserRole
from ..schemas import PhotoUploadResponse, FaceMatchResult, FaceSearchResponse
from ..auth import get_current_user, get_current_organizer, get_current_student_or_organizer
from ..services.face_service import get_face_service
from ..services.storage_service import StorageService
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/photos", tags=["photos"])
settings = get_settings()
storage = StorageService(settings.UPLOAD_DIR)


def process_photo_faces(photo_id: int, file_path: str, db_url: str):
    """Background task: run face detection and save encodings."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from ..models import EventPhoto
    from ..database import Base

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        photo = db.query(EventPhoto).filter(EventPhoto.id == photo_id).first()
        if not photo or photo.processing_status == "completed":
            return
        photo.processing_status = "processing"
        db.commit()

        service = get_face_service()
        abs_path = Path(file_path)
        if not abs_path.is_absolute():
            abs_path = Path.cwd() / file_path
        if not abs_path.exists():
            abs_path = Path(file_path)
        if not abs_path.exists():
            photo.processing_status = "failed"
            photo.processing_error = "File not found"
            db.commit()
            return

        encodings, count = service.detect_and_encode(str(abs_path))
        photo.face_encodings = encodings
        photo.face_count = count
        photo.processing_status = "completed"
        photo.processing_error = None
        db.commit()
    except Exception as e:
        logger.exception("Face processing failed")
        try:
            photo = db.query(EventPhoto).filter(EventPhoto.id == photo_id).first()
            if photo:
                photo.processing_status = "failed"
                photo.processing_error = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/upload", response_model=List[PhotoUploadResponse])
async def upload_photos(
    event_id: int,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_organizer),
):
    """Upload bulk photos to an event. Triggers face processing in background."""
    event = db.query(Event).filter(Event.id == event_id, Event.organizer_id == current_user.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    allowed = {".jpg", ".jpeg", ".png", ".webp"}
    results = []
    total_new_bytes = 0
    for f in files:
        ext = Path(f.filename).suffix.lower()
        if ext not in allowed:
            results.append(PhotoUploadResponse(id=-1, filename=f.filename, processing_status="skipped", message="Invalid file type"))
            continue

        content = await f.read()
        if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            results.append(PhotoUploadResponse(id=-1, filename=f.filename, processing_status="skipped", message="File too large"))
            continue

        ok, msg = storage.can_upload(len(content) * 2, settings.TOTAL_STORAGE_LIMIT_GB)
        if not ok:
            results.append(PhotoUploadResponse(id=-1, filename=f.filename, processing_status="skipped", message=msg))
            continue

        file_path, thumb_path = storage.save_photo(content, event_id, f.filename)

        photo = EventPhoto(
            event_id=event_id,
            file_path=file_path,
            thumbnail_path=thumb_path,
            original_filename=f.filename,
            processing_status="pending",
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)

        background_tasks.add_task(
            process_photo_faces,
            photo.id,
            file_path,
            settings.DATABASE_URL,
        )
        results.append(PhotoUploadResponse(id=photo.id, filename=f.filename, message="Queued for face processing"))
    return results


@router.delete("/{photo_id}")
def delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_organizer),
):
    """Delete a photo from an event."""
    photo = db.query(EventPhoto).filter(EventPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    event = db.query(Event).filter(Event.id == photo.event_id).first()
    if not event or event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    storage.delete_photo(photo.file_path)
    db.delete(photo)
    db.commit()
    return {"message": "Photo deleted"}


@router.get("/{photo_id}/download")
def download_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download original photo."""
    photo = db.query(EventPhoto).filter(EventPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    event = db.query(Event).filter(Event.id == photo.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.organizer_id != current_user.id and event.status != EventStatus.PUBLISHED:
        raise HTTPException(status_code=403, detail="Not authorized")

    abs_path = Path.cwd() / photo.file_path if not Path(photo.file_path).is_absolute() else Path(photo.file_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(abs_path, filename=photo.original_filename)


@router.post("/search", response_model=FaceSearchResponse)
async def search_by_face(
    event_id: Optional[int] = Form(None),
    access_code: Optional[str] = Form(None),
    tolerance: Optional[float] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student_or_organizer),
):
    """
    Search for photos containing the user's face.
    Uses OpenCV + HOG + CNN ensemble for best accuracy.
    """
    service = get_face_service(tolerance=tolerance)
    query_encodings: List[List[float]] = []

    if file and file.filename:
        content = await file.read()
        encodings = service.encode_from_bytes(content)
        if not encodings:
            raise HTTPException(status_code=400, detail="No face detected in image. Please upload a clear photo of your face.")
        query_encodings = encodings
    elif current_user.face_encoding:
        enc = current_user.face_encoding
        query_encodings = enc if (enc and isinstance(enc[0], list)) else [enc]
    else:
        raise HTTPException(status_code=400, detail="Please upload a photo of your face or register your face first.")

    # Resolve access_code to event_id for students
    resolved_event_id = event_id
    if access_code and not resolved_event_id:
        ev = db.query(Event).filter(
            Event.access_code == access_code.upper().strip(),
            Event.status == EventStatus.PUBLISHED,
        ).first()
        if ev:
            resolved_event_id = ev.id
        else:
            raise HTTPException(status_code=404, detail="Invalid or expired event code")

    # Students must provide event via access_code; organizers can search all
    if current_user.role not in (UserRole.ORGANIZER, UserRole.ADMIN) and not resolved_event_id:
        raise HTTPException(status_code=400, detail="Enter the event code from the organizer to find your photos.")

    # Build query for event photos
    q = db.query(EventPhoto, Event).join(Event, EventPhoto.event_id == Event.id).filter(
        EventPhoto.processing_status == "completed",
        EventPhoto.face_encodings.isnot(None),
    )
    if resolved_event_id:
        q = q.filter(Event.id == resolved_event_id)
    q = q.filter(Event.status == EventStatus.PUBLISHED)
    rows = q.all()

    matches = []
    for photo, event in rows:
        if not photo.face_encodings:
            continue
        face_matches = service.find_matches(query_encodings, photo.face_encodings)
        if face_matches:
            best = face_matches[0]
            matches.append(FaceMatchResult(
                photo_id=photo.id,
                file_path=photo.file_path,
                thumbnail_path=photo.thumbnail_path,
                event_name=event.name,
                event_id=event.id,
                match_confidence=best[1],
                face_index=best[0],
            ))

    return FaceSearchResponse(matches=matches, total_count=len(matches))
