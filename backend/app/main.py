"""FastAPI application entry point."""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import text

from .config import get_settings
from .routers import auth, events, photos, face_register
from .database import engine

logger = logging.getLogger(__name__)
settings = get_settings()
app = FastAPI(
    title=settings.APP_NAME,
    description="University event photo retrieval with face recognition",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(photos.router, prefix="/api")
app.include_router(face_register.router, prefix="/api")

# Serve uploaded files
uploads_path = Path(settings.UPLOAD_DIR)
if uploads_path.exists():
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def startup():
    """Verify database connection and schema on startup."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection OK")
        try:
            from sqlalchemy import inspect
            insp = inspect(engine)
            cols = [c["name"] for c in insp.get_columns("users")]
            for needed in ("phone_number", "otp_code", "otp_expires_at"):
                if needed not in cols:
                    logger.warning("Column %s missing in users. Run: alembic upgrade head", needed)
        except Exception as ex:
            logger.warning("Could not verify schema: %s", ex)
    except Exception as e:
        logger.error("Database connection failed: %s", e)


@app.get("/api/health")
def health():
    """Basic health check."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": str(e)}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
