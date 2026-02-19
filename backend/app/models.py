"""SQLAlchemy models for the application."""
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean,
    Enum,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship

from .database import Base
import enum


class UserRole(str, enum.Enum):
    ORGANIZER = "organizer"
    STUDENT = "student"
    ADMIN = "admin"


class EventStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    PROCESSING = "processing"
    ARCHIVED = "archived"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, values_callable=lambda x: [e.value for e in x]), default=UserRole.STUDENT, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Face encoding for students (128-d vector stored as JSON)
    face_encoding = Column(JSON, nullable=True)  # Stored as list of 128 floats
    face_photo_url = Column(String(500), nullable=True)

    # 2FA for organizers (SMS OTP)
    phone_number = Column(String(20), nullable=True)
    totp_enabled = Column(Boolean, default=False, nullable=False)
    otp_code = Column(String(10), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)

    events = relationship("Event", back_populates="organizer")
    face_searches = relationship("FaceSearch", back_populates="user")


class PendingOrganizerRegistration(Base):
    """Temporary storage for organizer signup during OTP verification."""
    __tablename__ = "pending_organizer_registrations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone_number = Column(String(20), nullable=False)
    otp_code = Column(String(10), nullable=False)
    otp_expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def _generate_access_code() -> str:
    """Generate 8-char alphanumeric code for event access."""
    import random
    import string
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=8))


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    access_code = Column(String(16), unique=True, nullable=True, index=True)  # e.g. ABC12XYZ
    description = Column(Text, nullable=True)
    event_date = Column(DateTime, nullable=True)
    status = Column(Enum(EventStatus, values_callable=lambda x: [e.value for e in x]), default=EventStatus.DRAFT, nullable=False)
    cover_image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organizer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    organizer = relationship("User", back_populates="events")

    photos = relationship("EventPhoto", back_populates="event", cascade="all, delete-orphan")


class EventPhoto(Base):
    __tablename__ = "event_photos"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    original_filename = Column(String(255), nullable=False)

    # Face encodings: array of 128-d vectors (each face = one encoding)
    face_encodings = Column(JSON, nullable=True)  # List of lists [[128 floats], ...]
    face_count = Column(Integer, default=0, nullable=False)
    processing_status = Column(String(50), default="pending")  # pending, processing, completed, failed
    processing_error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="photos")


class FaceSearch(Base):
    """Log of face search requests for analytics."""
    __tablename__ = "face_searches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    match_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="face_searches")
