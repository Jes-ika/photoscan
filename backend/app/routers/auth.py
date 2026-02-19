"""Authentication API endpoints."""
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import User, UserRole, PendingOrganizerRegistration
from ..schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    OrganizerRegisterSendOtp, OrganizerRegisterVerify, OrganizerRegisterOtpSent,
)
from ..auth import (
    get_password_hash, create_access_token, create_register_otp_token,
    verify_password, get_current_user, decode_token,
)
from ..services.sms_service import (
    generate_otp,
    send_verification,
    send_sms_otp,
    check_verification,
    is_twilio_configured,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _user_response(user: User) -> UserResponse:
    phone = getattr(user, "phone_number", None)
    if phone and len(phone) > 4:
        phone = phone[:3] + "****" + phone[-2:]
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        face_registered=user.face_encoding is not None,
        totp_enabled=getattr(user, "totp_enabled", False),
        phone_number=phone,
        created_at=user.created_at,
    )


@router.post("/register", response_model=Token)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new student. Organizers must use register-organizer-send-otp + register-organizer-verify."""
    try:
        if user_data.role and user_data.role.lower() in ("organizer", "admin"):
            raise HTTPException(
                status_code=400,
                detail="Event organizers must register with phone verification. Please select 'Event Organizer' and enter your phone number.",
            )
        existing = db.query(User).filter(User.email == user_data.email.strip().lower()).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user = User(
            email=user_data.email.strip().lower(),
            full_name=user_data.full_name,
            hashed_password=get_password_hash(user_data.password),
            role=UserRole.STUDENT,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(data={"sub": str(user.id)})
        return Token(access_token=token, user=_user_response(user))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Registration failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token. No OTP at login (OTP only at registration for organizers)."""
    try:
        user = db.query(User).filter(User.email == credentials.email.strip().lower()).first()
    except Exception as e:
        logger.exception("Login database error: %s", e)
        detail = "Service temporarily unavailable. Please try again."
        if get_settings().DEBUG:
            detail = f"{detail} ({type(e).__name__}: {str(e)})"
        raise HTTPException(status_code=503, detail=detail)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return Token(access_token=create_access_token(data={"sub": str(user.id)}), user=_user_response(user))


@router.post("/register-organizer-send-otp", response_model=OrganizerRegisterOtpSent)
def register_organizer_send_otp(data: OrganizerRegisterSendOtp, db: Session = Depends(get_db)):
    """Step 1: Send OTP to organizer's phone during registration."""
    email = data.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    pending = db.query(PendingOrganizerRegistration).filter(PendingOrganizerRegistration.email == email).first()
    if pending:
        db.delete(pending)
        db.commit()
    phone_clean = data.phone_number.strip().replace(" ", "")
    if not phone_clean.startswith("+"):
        phone_clean = "+91" + phone_clean.lstrip("0") if len(phone_clean) == 10 else "+" + phone_clean
    otp = generate_otp(6)
    pending = PendingOrganizerRegistration(
        email=email,
        full_name=data.full_name,
        password_hash=get_password_hash(data.password),
        phone_number=phone_clean,
        otp_code=otp,
        otp_expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(pending)
    db.commit()
    db.refresh(pending)
    st = get_settings()
    if is_twilio_configured(st):
        sent, _ = send_verification(phone_clean, st)
        if not sent:
            db.delete(pending)
            db.commit()
            raise HTTPException(status_code=503, detail="Failed to send OTP")
        dev_otp = None
    else:
        sent, dev_otp = send_sms_otp(phone_clean, otp, st)
    temp_token = create_register_otp_token(pending.id)
    return OrganizerRegisterOtpSent(temp_token=temp_token, dev_otp=dev_otp)


@router.post("/register-organizer-verify", response_model=Token)
def register_organizer_verify(data: OrganizerRegisterVerify, db: Session = Depends(get_db)):
    """Step 2: Verify OTP and create organizer account."""
    payload = decode_token(data.temp_token)
    if not payload or payload.get("type") != "register_otp":
        raise HTTPException(status_code=401, detail="Invalid or expired verification. Please start again.")
    pending_id = payload.get("sub")
    if not pending_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    pending = db.query(PendingOrganizerRegistration).filter(PendingOrganizerRegistration.id == int(pending_id)).first()
    if not pending:
        raise HTTPException(status_code=401, detail="Session expired. Please register again.")
    if datetime.utcnow() > pending.otp_expires_at:
        db.delete(pending)
        db.commit()
        raise HTTPException(status_code=401, detail="OTP expired. Please start registration again.")
    st = get_settings()
    if is_twilio_configured(st):
        if not check_verification(pending.phone_number, data.code, st):
            raise HTTPException(status_code=401, detail="Invalid OTP")
    elif pending.otp_code != data.code.strip():
        raise HTTPException(status_code=401, detail="Invalid OTP")
    user = User(
        email=pending.email,
        full_name=pending.full_name,
        hashed_password=pending.password_hash,
        role=UserRole.ORGANIZER,
        phone_number=pending.phone_number,
        totp_enabled=False,
    )
    db.add(user)
    db.delete(pending)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token, user=_user_response(user))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return _user_response(current_user)


