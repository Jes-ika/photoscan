"""Event management API endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import User, Event, EventPhoto, EventStatus, UserRole, _generate_access_code
from ..services.storage_service import StorageService
from ..schemas import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventDetailResponse,
    EventPhotoResponse,
    ProcessingStatusResponse,
)
from ..auth import get_current_user, get_current_organizer

router = APIRouter(prefix="/events", tags=["events"])
storage = StorageService()


def _event_to_response(event: Event, photo_count: int = None) -> EventResponse:
    if photo_count is None:
        photo_count = len(event.photos) if event.photos else 0
    return EventResponse(
        id=event.id,
        name=event.name,
        description=event.description,
        event_date=event.event_date,
        status=event.status.value,
        cover_image_url=event.cover_image_url,
        photo_count=photo_count,
        created_at=event.created_at,
        access_code=getattr(event, "access_code", None),
    )


@router.get("/storage-usage")
def get_storage_usage(current_user: User = Depends(get_current_organizer)):
    """Get storage used and limit (organizer only)."""
    from ..config import get_settings
    settings = get_settings()
    used_gb = storage.get_usage_gb()
    limit_gb = settings.TOTAL_STORAGE_LIMIT_GB
    return {
        "used_gb": round(used_gb, 2),
        "limit_gb": limit_gb,
        "used_percent": round((used_gb / limit_gb) * 100, 1),
        "remaining_gb": round(max(0, limit_gb - used_gb), 2),
    }


@router.get("/by-code/{access_code}")
def get_event_by_code(access_code: str, db: Session = Depends(get_db)):
    """Public: get event by access code. Returns event info for photo search (no auth required)."""
    event = db.query(Event).filter(
        Event.access_code == access_code.upper().strip(),
        Event.status == EventStatus.PUBLISHED,
    ).first()
    if not event:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Invalid or expired event code")
    count = db.query(EventPhoto).filter(EventPhoto.event_id == event.id).count()
    return {"id": event.id, "name": event.name, "access_code": event.access_code, "photo_count": count}


@router.get("", response_model=List[EventResponse])
def list_events(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List events. Organizers see their own; students see none (use access code to find photos)."""
    if current_user.role == UserRole.STUDENT:
        return []
    q = db.query(Event).filter(Event.organizer_id == current_user.id)
    if status_filter:
        try:
            q = q.filter(Event.status == EventStatus(status_filter))
        except ValueError:
            pass

    events = q.order_by(Event.created_at.desc()).all()
    results = []
    for e in events:
        count = db.query(EventPhoto).filter(EventPhoto.event_id == e.id).count()
        results.append(_event_to_response(e, count))
    return results


@router.post("", response_model=EventResponse)
def create_event(
    data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_organizer),
):
    """Create a new event (organizer only). Generates access_code for student photo lookup."""
    code = _generate_access_code()
    while db.query(Event).filter(Event.access_code == code).first():
        code = _generate_access_code()
    event = Event(
        name=data.name,
        description=data.description,
        event_date=data.event_date,
        organizer_id=current_user.id,
        status=EventStatus.DRAFT,
        access_code=code,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _event_to_response(event, 0)


@router.get("/{event_id}", response_model=EventDetailResponse)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get event details with photos."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.organizer_id != current_user.id and event.status != EventStatus.PUBLISHED:
        raise HTTPException(status_code=403, detail="Event not accessible")

    photos = [
        EventPhotoResponse(
            id=p.id,
            file_path=p.file_path,
            thumbnail_path=p.thumbnail_path,
            face_count=p.face_count,
            processing_status=p.processing_status,
            created_at=p.created_at,
        )
        for p in event.photos
    ]
    return EventDetailResponse(
        id=event.id,
        name=event.name,
        description=event.description,
        event_date=event.event_date,
        status=event.status.value,
        cover_image_url=event.cover_image_url,
        photo_count=len(photos),
        created_at=event.created_at,
        access_code=getattr(event, "access_code", None),
        photos=photos,
    )


@router.patch("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    data: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_organizer),
):
    """Update event (organizer only)."""
    event = db.query(Event).filter(Event.id == event_id, Event.organizer_id == current_user.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if data.name is not None:
        event.name = data.name
    if data.description is not None:
        event.description = data.description
    if data.event_date is not None:
        event.event_date = data.event_date
    if data.status is not None:
        try:
            event.status = EventStatus(data.status)
        except ValueError:
            pass
    db.commit()
    db.refresh(event)
    return _event_to_response(event)


@router.delete("/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_organizer),
):
    """Delete event and all its photos (organizer only)."""
    event = db.query(Event).filter(Event.id == event_id, Event.organizer_id == current_user.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"message": "Event deleted"}


@router.get("/{event_id}/processing-status", response_model=ProcessingStatusResponse)
def get_processing_status(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_organizer),
):
    """Get face processing status for an event."""
    event = db.query(Event).filter(Event.id == event_id, Event.organizer_id == current_user.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    photos = db.query(EventPhoto).filter(EventPhoto.event_id == event_id).all()
    total = len(photos)
    processed = sum(1 for p in photos if p.processing_status == "completed")
    failed = sum(1 for p in photos if p.processing_status == "failed")
    progress = (processed / total * 100) if total else 0
    status_val = "completed" if processed == total and failed == 0 else ("processing" if processed + failed < total else "completed")
    return ProcessingStatusResponse(
        event_id=event_id,
        total_photos=total,
        processed_photos=processed,
        failed_photos=failed,
        status=status_val,
        progress_percent=round(progress, 1),
    )
