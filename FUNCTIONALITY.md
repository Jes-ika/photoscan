# University Photo Retrieval – Functionality Documentation

This document describes all features and functionality of the University Photo Retrieval application (similar to KwikPic) for Rashtriya Raksha University.

---

## 1. User Roles

| Role | Description |
|------|-------------|
| **Student** | Finds photos of themselves from events; registers face; uses event access code |
| **Organizer** | Creates events, uploads photos, manages events; has 2FA (SMS OTP); shares QR/code with attendees |
| **Admin** | Same as Organizer (organizer-level access) |

---

## 2. Authentication

### Registration (`/register`)
- Email, password (min 8 chars), full name
- Role selection: Student or Event Organizer
- Creates account and logs in

### Login (`/login`)
- Email and password
- Role selection: Student or Organizer (for correct redirect)
- Organizers with 2FA: receive OTP via SMS; enter OTP to complete login
- Dev mode: if SMS is not configured, OTP is shown on screen

### 2FA (Organizers only)
- SMS OTP via Twilio Verify
- Dev mode: OTP shown in UI when Twilio not configured
- Setup in Profile → 2FA Settings

---

## 3. Events

### Organizer: Create Event
- Name, description, date
- Status: draft or published
- On creation, a unique **access code** (e.g. `ABC12XYZ`) is generated

### Organizer: Event Dashboard (`/organizer`)
- Lists only the organizer’s events
- Storage usage (e.g. 4 GB limit)
- Link to 2FA settings
- Create new event

### Organizer: Event Detail (`/organizer/events/:id`)
- Event info and publish button
- **QR code** – attendees scan to open photo search for that event
- **Access code** – shown and copyable; attendees enter manually
- Bulk photo upload (drag & drop)
- Face detection runs in the background
- Photo grid with face count and status
- Delete photos

### Students: Event Access
- Students do **not** see a list of all events
- Access via:
  1. **QR code** – scan organizer’s QR → opens `/search?code=XYZ`
  2. **Manual code** – enter code on `/search`
- Code is validated before search is allowed

---

## 4. Photo Search (Face Recognition)

### How It Works
- User provides a face image (upload, camera, or registered face)
- System encodes the face (128‑dimensional vector)
- Matches against encodings in event photos
- Returns matching photos

### Student Flow
1. Enter event code (or arrive via QR)
2. Upload selfie, use camera, or use registered face
3. Click “Find My Photos”
4. View and download matches

### Organizer Flow
- Can search across all their published events
- Optional event filter

### Face Registration (`/profile`)
- Students can register a face (upload or camera)
- Blink detection for camera capture
- Registered face is used for search when no new photo is uploaded

### Technical
- Models: HOG (default), OpenCV Haar, CNN (accuracy vs speed)
- Configurable tolerance (`FACE_MATCH_TOLERANCE`, e.g. 0.55)
- `num_jitters` controls encoding quality

---

## 5. Profile

### All Users
- View name, email, role
- Face registration (upload or camera with blink)
- Remove registered face

### Organizers
- 2FA setup: phone number, send OTP, verify
- Enable or disable 2FA

---

## 6. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/verify-2fa` | Complete 2FA login |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/2fa/send-otp` | Send OTP to phone |
| POST | `/api/auth/2fa/verify-phone` | Verify phone, enable 2FA |
| POST | `/api/auth/2fa/request-disable-otp` | Send OTP to disable 2FA |
| POST | `/api/auth/2fa/disable` | Disable 2FA |
| GET | `/api/events` | List events (organizers only) |
| GET | `/api/events/by-code/{code}` | Get event by access code (public) |
| POST | `/api/events` | Create event |
| GET | `/api/events/{id}` | Get event details |
| PATCH | `/api/events/{id}` | Update event |
| DELETE | `/api/events/{id}` | Delete event |
| GET | `/api/events/storage-usage` | Storage usage |
| GET | `/api/events/{id}/processing-status` | Face processing status |
| POST | `/api/photos/upload` | Upload photos to event |
| POST | `/api/photos/search` | Face search (file, event_id, access_code) |
| GET | `/api/photos/{id}/download` | Download photo |
| DELETE | `/api/photos/{id}` | Delete photo |
| POST | `/api/face/register` | Register face |
| DELETE | `/api/face/register` | Remove face |

---

## 7. Configuration (Backend `.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MariaDB/MySQL connection |
| `SECRET_KEY` | JWT signing |
| `FACE_MATCH_TOLERANCE` | Matching strictness (e.g. 0.55) |
| `FACE_DETECTION_MODEL` | hog, opencv_haar, or cnn |
| `TWILIO_ACCOUNT_SID` | Twilio Verify |
| `TWILIO_AUTH_TOKEN` | Twilio Verify |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify Service |
| `TOTAL_STORAGE_LIMIT_GB` | Storage limit (e.g. 4) |

---

## 8. Frontend Routes

| Path | Access | Description |
|------|--------|--------------|
| `/` | Public | Home |
| `/login` | Public | Login |
| `/register` | Public | Register |
| `/search` | Auth | Photo search (students need code) |
| `/search?code=XYZ` | Auth | Search with code from QR |
| `/my-photos` | Auth | Redirect to search |
| `/profile` | Auth | Profile and face / 2FA |
| `/organizer` | Organizer | Event dashboard |
| `/organizer/events/new` | Organizer | Create event |
| `/organizer/events/:id` | Organizer | Event detail, QR, photos |

---

## 9. Security

- JWT for API auth
- 2FA for organizers (SMS OTP)
- Event access codes (8‑char) for students
- Students only see events they access via code
- Face encodings stored; no raw biometric images shared
