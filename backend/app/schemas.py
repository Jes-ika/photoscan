"""Pydantic schemas for API validation and serialization."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    role: Optional[str] = "student"


class OrganizerRegisterSendOtp(UserBase):
    password: str = Field(..., min_length=8)
    phone_number: str = Field(..., min_length=10)


class OrganizerRegisterVerify(BaseModel):
    temp_token: str
    code: str = Field(..., min_length=6, max_length=6)


class OrganizerRegisterOtpSent(BaseModel):
    temp_token: str
    message: str = "OTP sent to your mobile number"
    dev_otp: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    login_as: Optional[str] = "student"  # student | organizer


class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    face_registered: bool = False
    totp_enabled: bool = False
    phone_number: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class Login2FARequired(BaseModel):
    needs_2fa: bool = True
    temp_token: str
    message: str = "Enter the OTP sent to your mobile number"
    dev_otp: Optional[str] = None  # Only when Twilio not configured (for testing)


class Verify2FARequest(BaseModel):
    temp_token: str
    code: str


class SendOtpRequest(BaseModel):
    phone_number: str = Field(..., min_length=10)


class SendOtpResponse(BaseModel):
    message: str = "OTP sent to your mobile number"
    dev_otp: Optional[str] = None  # Only set when Twilio not configured (for testing)


class VerifyPhoneRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)
    phone_number: str = Field(..., min_length=10)


class Enable2FARequest(BaseModel):
    code: str


# Event Schemas
class EventBase(BaseModel):
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    status: Optional[str] = None


class EventPhotoResponse(BaseModel):
    id: int
    file_path: str
    thumbnail_path: Optional[str]
    face_count: int
    processing_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class EventResponse(EventBase):
    id: int
    status: str
    cover_image_url: Optional[str]
    photo_count: int = 0
    created_at: datetime
    access_code: Optional[str] = None

    class Config:
        from_attributes = True


class EventDetailResponse(EventResponse):
    photos: List[EventPhotoResponse] = []


# Photo Schemas
class PhotoUploadResponse(BaseModel):
    id: int
    filename: str
    processing_status: str = "pending"
    message: str = "Photo queued for face processing"


class FaceMatchResult(BaseModel):
    photo_id: int
    file_path: str
    thumbnail_path: Optional[str]
    event_name: str
    event_id: int
    match_confidence: float
    face_index: int = 0


class FaceSearchResponse(BaseModel):
    matches: List[FaceMatchResult]
    total_count: int
    search_id: Optional[int] = None


# Face Registration
class FaceRegisterRequest(BaseModel):
    """Base64 encoded image or multipart file."""
    pass


class FaceRegisterResponse(BaseModel):
    success: bool
    message: str


# Processing
class ProcessingStatusResponse(BaseModel):
    event_id: int
    total_photos: int
    processed_photos: int
    failed_photos: int
    status: str
    progress_percent: float
