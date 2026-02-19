"""SMS OTP via Twilio Verify API. Dev mode when not configured."""
import logging
import random
import string
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


def generate_otp(length: int = 6) -> str:
    """Generate numeric OTP (for dev mode only)."""
    return "".join(random.choices(string.digits, k=length))


def _normalize_phone(phone: str) -> str:
    """Return E.164 format e.g. +919876543210."""
    p = phone.strip().replace(" ", "")
    if not p.startswith("+"):
        p = "+91" + p.lstrip("0") if len(p) == 10 else "+" + p
    return p


def is_twilio_configured(settings) -> bool:
    """True if Twilio Verify is configured."""
    sid = getattr(settings, "TWILIO_ACCOUNT_SID", None) or ""
    token = getattr(settings, "TWILIO_AUTH_TOKEN", None) or ""
    verify_sid = getattr(settings, "TWILIO_VERIFY_SERVICE_SID", None) or ""
    return bool(sid and token and verify_sid)


def send_verification(phone: str, settings) -> Tuple[bool, Optional[str]]:
    """
    Send OTP via Twilio Verify. Returns (sent_ok, dev_otp_fallback).
    Twilio generates and sends the OTP; we don't store it.
    """
    phone_norm = _normalize_phone(phone)

    if is_twilio_configured(settings):
        try:
            from twilio.rest import Client
            client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
            )
            client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verifications.create(
                to=phone_norm,
                channel="sms",
            )
            return True, None
        except Exception as e:
            logger.error("Twilio Verify send failed: %s", e)
            return False, None

    otp = generate_otp(6)
    logger.info("[DEV] OTP for %s: %s", phone_norm, otp)
    return True, otp


def check_verification(phone: str, code: str, settings) -> bool:
    """Verify OTP via Twilio Verify. Returns True if valid."""
    phone_norm = _normalize_phone(phone)

    if is_twilio_configured(settings):
        try:
            from twilio.rest import Client
            client = Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
            )
            check = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verification_checks.create(
                to=phone_norm,
                code=code.strip(),
            )
            return check.status == "approved"
        except Exception as e:
            logger.error("Twilio Verify check failed: %s", e)
            return False

    return False


# Legacy compatibility - auth may still call send_sms_otp with (phone, otp)
def send_sms_otp(phone: str, otp: str, settings) -> Tuple[bool, Optional[str]]:
    """Legacy: redirects to send_verification (otp ignored when using Twilio Verify)."""
    return send_verification(phone, settings)
