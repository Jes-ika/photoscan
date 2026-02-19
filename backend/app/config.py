"""Application configuration."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment."""
    
    # App
    APP_NAME: str = "University Photo Retrieval"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "mysql+pymysql://root:password@localhost:3306/uni_photos"
    
    # Auth
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Face Recognition (all dlib-compatible models output 128-d embeddings)
    FACE_MATCH_TOLERANCE: float = 0.55  # dlib: 0.5-0.6
    FACE_DETECTION_MODEL: str = "all_models"  # all_models, dlib_best, retinaface_dlib, cnn, hog
    MAX_FACES_PER_IMAGE: int = 30  # For large group photos
    FACE_UPSAMPLE: int = 2  # 1=fast, 2-3=find more small faces (slower)
    
    # SMS OTP via Twilio Verify (verify.twilio.com). Dev mode when not set.
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_VERIFY_SERVICE_SID: str = ""  # e.g. VA80621208a8a8fa72fc402e24e5cd2571

    # Storage (4GB total, ~2000 photos at ~2MB each)
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    TOTAL_STORAGE_LIMIT_GB: float = 4.0
    ALLOWED_IMAGE_EXTENSIONS: set = {".jpg", ".jpeg", ".png", ".webp"}
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
