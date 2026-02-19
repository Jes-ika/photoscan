"""Face registration for students."""
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import FaceRegisterResponse
from ..auth import get_current_user
from ..services.face_service import get_face_service
from ..services.storage_service import StorageService
from ..config import get_settings

router = APIRouter(prefix="/face", tags=["face-registration"])
storage = StorageService(get_settings().UPLOAD_DIR)


@router.post("/register", response_model=FaceRegisterResponse)
async def register_face(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register user's face for faster future searches (selfie/upload)."""
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    service = get_face_service()
    encodings = service.encode_from_bytes(content)
    if not encodings:
        raise HTTPException(status_code=400, detail="No face detected. Please upload a clear photo of your face.")

    # Save face photo; store all encodings from ensemble for better matching
    face_url = storage.save_face_photo(content, current_user.id)
    current_user.face_encoding = encodings[0] if len(encodings) == 1 else encodings
    current_user.face_photo_url = face_url
    db.commit()
    return FaceRegisterResponse(success=True, message="Face registered successfully")


@router.delete("/register", response_model=FaceRegisterResponse)
def remove_face(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove registered face from account."""
    current_user.face_encoding = None
    current_user.face_photo_url = None
    db.commit()
    return FaceRegisterResponse(success=True, message="Face registration removed")
