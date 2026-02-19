# University Photo Retrieval Platform

A full-stack web application for face-based photo retrieval from university events. Similar to KwikPic, it allows event organizers to upload bulk photos and students to find their photos using facial recognition.

## Features

- **Event Organizers**: Create events, upload bulk images, automatic face detection/encoding, manage and delete photos
- **Students**: Register/login, upload selfie or use registered face, find matched photos, download selected images
- **High-accuracy face matching**: Multiple backends (dlib, InsightFace, DeepFace, RetinaFace), 128-d or 512-d encodings, configurable tolerance
- **Modern UI**: Deep Red & Navy Blue university theme, glassmorphism, smooth animations

## Tech Stack

- **Backend**: FastAPI, MariaDB, SQLAlchemy
- **Face Recognition**: dlib, InsightFace, DeepFace, RetinaFace (128-d or 512-d encodings)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Framer Motion

## Prerequisites (Windows)

- **Python 3.10** (for RetinaFace + TensorFlow; 3.14 not supported by TensorFlow)
- Node.js 18+
- MariaDB 10.6+ ([Download](https://mariadb.org/download/))

## Quick Start (Windows)

### 1. Database

Install MariaDB, then create the database:

```powershell
mysql -u root -p -e "CREATE DATABASE uni_photos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Or use HeidiSQL / DBeaver / phpMyAdmin to create a database named `uni_photos`.

### 2. Backend

**Option A – RetinaFace / all_models (recommended):**

Requires Python 3.10 (TensorFlow does not support 3.14):

```powershell
cd backend
py -3.10 -m venv venv310
.\venv310\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Option B – Without RetinaFace (Python 3.11+):**

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt   # Skip tensorflow/retina-face if Python 3.14
```

Copy `backend\.env.example` to `backend\.env` and set your `DATABASE_URL` and `SECRET_KEY`.

Run migrations:

```powershell
alembic upgrade head
```

Start the server:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 3. Frontend

Open a new terminal:

```powershell
cd frontend
npm install
npm run dev
```

### 4. Open

Navigate to http://localhost:3000. The frontend proxies API requests to the backend on port **8001**.

## Environment Variables

Create `backend\.env` (copy from `backend\.env.example`):

```env
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/uni_photos
SECRET_KEY=your-secret-key-change-in-production
FACE_MATCH_TOLERANCE=0.45
FACE_DETECTION_MODEL=hog
```

Replace `YOUR_PASSWORD` with your MariaDB root password.

### SMS OTP (2FA for Organizers)

Uses **Twilio Verify** for OTP. Add to `backend\.env`:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...   # From Twilio Verify Console
```

If not set, dev mode logs the OTP in the backend console and returns it in API responses.

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   ├── routers/
│   │   └── services/
│   └── alembic/
└── frontend/
    ├── src/
    │   ├── pages/
    │   ├── components/
    │   ├── contexts/
    │   └── lib/
    └── ...
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET | /api/events | List events |
| POST | /api/events | Create event |
| GET | /api/events/{id} | Event details |
| POST | /api/photos/upload | Upload photos |
| POST | /api/photos/search | Face search |
| POST | /api/face/register | Register face |

## Accuracy Tuning

- **FACE_MATCH_TOLERANCE**: Lower = stricter. dlib: 0.5–0.6.
- **FACE_DETECTION_MODEL** (all dlib-compatible = 128-d):
  - `all_models` – **Default.** RetinaFace + CNN + HOG + OpenCV + low-light & sharpen
  - `dlib_best` – CNN + HOG + OpenCV ensemble
  - `retinaface_dlib` – RetinaFace + dlib encode
  - `cnn`, `hog`, `opencv_haar` – single detectors
- **MAX_FACES_PER_IMAGE**: Default 30 for large groups.
- **FACE_UPSAMPLE**: 1=fast, 2–3=find more small faces (slower).

## Windows Notes

- **dlib**: Installing `face_recognition` may require Visual C++ Build Tools. If `pip install` fails, install [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) first.
- **Activate venv**: If `Activate.ps1` fails due to execution policy, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

## License

MIT
