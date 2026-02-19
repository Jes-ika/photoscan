"""
Face recognition with multiple backends:
- dlib (hog, cnn, opencv_haar): 128-d, face_recognition
- insightface: RetinaFace + ArcFace, 512-d
- deepface: ArcFace backend, 512-d
- retinaface: RetinaFace detection + ArcFace embedding, 512-d

Note: 128-d and 512-d encodings are incompatible. When switching models, re-upload photos.
"""
import io
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Optional backends
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    np = None
    NUMPY_AVAILABLE = False

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    face_recognition = None
    FACE_RECOGNITION_AVAILABLE = False

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    cv2 = None
    OPENCV_AVAILABLE = False

try:
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    FaceAnalysis = None
    INSIGHTFACE_AVAILABLE = False

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DeepFace = None
    DEEPFACE_AVAILABLE = False

try:
    from retinaface import RetinaFace
    RETINAFACE_AVAILABLE = True
except ImportError:
    RetinaFace = None
    RETINAFACE_AVAILABLE = False


def _cosine_distance(a: "np.ndarray", b: "np.ndarray") -> float:
    """Cosine distance: 0 = identical, 2 = opposite."""
    an = a / (np.linalg.norm(a) + 1e-10)
    bn = b / (np.linalg.norm(b) + 1e-10)
    return float(1.0 - np.dot(an, bn))


def _opencv_face_locations(image_array: "np.ndarray") -> List[Tuple[int, int, int, int]]:
    """OpenCV Haar. Returns (top, right, bottom, left). Lower scaleFactor = more faces, slower."""
    gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    # scaleFactor 1.05, minNeighbors 4 = more sensitive
    faces = face_cascade.detectMultiScale(gray, 1.05, 4, minSize=(24, 24))
    return [(int(y), int(x + w), int(y + h), int(x)) for (x, y, w, h) in faces]


def _iou_box(box_a: Tuple[int, int, int, int], box_b: Tuple[int, int, int, int]) -> float:
    """IoU of two (top, right, bottom, left) boxes. 1 = identical, 0 = no overlap."""
    ta, ra, ba, la = box_a
    tb, rb, bb, lb = box_b
    xi1 = max(la, lb)
    yi1 = max(ta, tb)
    xi2 = min(ra, rb)
    yi2 = min(ba, bb)
    inter_w = max(0, xi2 - xi1)
    inter_h = max(0, yi2 - yi1)
    inter_area = inter_w * inter_h
    area_a = (ra - la) * (ba - ta)
    area_b = (rb - lb) * (bb - tb)
    union_area = area_a + area_b - inter_area
    return inter_area / (union_area + 1e-10)


def _merge_face_locations(
    all_locations: List[Tuple[int, int, int, int]], iou_threshold: float = 0.5
) -> List[Tuple[int, int, int, int]]:
    """Remove duplicate detections. Keep first (priority) when IoU > threshold."""
    if not all_locations:
        return []
    merged = [all_locations[0]]
    for box in all_locations[1:]:
        if not any(_iou_box(box, m) >= iou_threshold for m in merged):
            merged.append(box)
    return merged


def _retinaface_to_trbl(resp: dict) -> List[Tuple[int, int, int, int]]:
    """Convert RetinaFace bbox (x1,y1,x2,y2) to (top, right, bottom, left)."""
    locations = []
    if not isinstance(resp, dict):
        return locations
    for _, face in resp.items():
        box = face.get("facial_area", [])
        if len(box) >= 4:
            x1, y1, x2, y2 = int(box[0]), int(box[1]), int(box[2]), int(box[3])
            if x2 > x1 and y2 > y1:
                locations.append((y1, x2, y2, x1))  # top, right, bottom, left
    return locations


def _preprocess_low_light(img: "np.ndarray") -> "np.ndarray":
    """Enhance dark images: CLAHE on luminance. Only apply if image is dim (mean L < 100)."""
    if not OPENCV_AVAILABLE or img is None or img.size == 0:
        return img
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    if np.mean(l) > 100:  # Skip if image is bright enough
        return img
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    lab = cv2.merge([l, a, b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


def _preprocess_sharpen(img: "np.ndarray") -> "np.ndarray":
    """Mild sharpen to help slight blur. Unsharp mask (gentle to avoid amplifying noise)."""
    if not OPENCV_AVAILABLE or img is None:
        return img
    blurred = cv2.GaussianBlur(img, (0, 0), 2.0)
    return cv2.addWeighted(img, 1.25, blurred, -0.25, 0)


# Lazy-loaded InsightFace app (heavy)
_insightface_app: Optional["FaceAnalysis"] = None


def _get_insightface_app():
    global _insightface_app
    if _insightface_app is None and INSIGHTFACE_AVAILABLE:
        _insightface_app = FaceAnalysis(providers=["CPUExecutionProvider"])
        _insightface_app.prepare(ctx_id=0, det_size=(640, 640))
    return _insightface_app


class FaceRecognitionService:
    """Face detection and encoding. Supports dlib, InsightFace, DeepFace, RetinaFace."""

    def __init__(self, tolerance: float = 0.55, max_faces: int = 25, detection_model: str = "hog", upsample: int = 2):
        self.tolerance = tolerance
        self.max_faces = max_faces
        self.detection_model = (detection_model or "hog").lower()
        self.upsample = max(1, min(upsample, 4))  # 1-4, higher = more small faces

    def _ensure_numpy(self) -> None:
        if not NUMPY_AVAILABLE:
            raise RuntimeError("numpy is required")

    def _ensure_available(self) -> None:
        dlib_models = ("hog", "cnn", "opencv_haar", "dlib_best", "retinaface_dlib", "all_models")
        if self.detection_model in dlib_models:
            if not FACE_RECOGNITION_AVAILABLE:
                raise RuntimeError("face_recognition is not installed. pip install face_recognition")
        if self.detection_model == "retinaface_dlib" and not RETINAFACE_AVAILABLE and not INSIGHTFACE_AVAILABLE:
            raise RuntimeError("retinaface_dlib requires retina-face or insightface")
        if self.detection_model == "insightface" and not INSIGHTFACE_AVAILABLE:
            raise RuntimeError("insightface is not installed. pip install insightface")
        elif self.detection_model == "deepface" and not DEEPFACE_AVAILABLE:
            raise RuntimeError("deepface is not installed. pip install deepface")
        elif self.detection_model == "retinaface" and not (RETINAFACE_AVAILABLE and INSIGHTFACE_AVAILABLE):
            raise RuntimeError("retina-face and insightface required. pip install retina-face insightface")

    def _preprocess_image(self, image_array: "np.ndarray", enhance: bool = False) -> "np.ndarray":
        if not NUMPY_AVAILABLE or image_array is None:
            return image_array
        # Upscale small images
        h, w = image_array.shape[:2]
        min_side = 480
        if (h < min_side or w < min_side) and OPENCV_AVAILABLE:
            scale = min_side / min(h, w)
            new_h, new_w = int(h * scale), int(w * scale)
            image_array = cv2.resize(image_array, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        # Optional: enhance for low light + slight blur (when using all_models)
        if enhance and OPENCV_AVAILABLE:
            img = _preprocess_low_light(image_array)
            image_array = _preprocess_sharpen(img)
        return image_array

    def _encode_dlib(self, image_array: "np.ndarray", model: str, num_jitters: int = 5) -> List[List[float]]:
        """Dlib/face_recognition encoding, 128-d. Uses upsampling for better small-face detection."""
        if model == "opencv_haar" and OPENCV_AVAILABLE:
            locations = _opencv_face_locations(image_array)
            if not locations:
                return []
            encodings = face_recognition.face_encodings(
                image_array,
                known_face_locations=locations[: self.max_faces],
                num_jitters=min(num_jitters, 5),
            )
        elif model == "dlib_best":
            return self._encode_dlib_ensemble(image_array, num_jitters)
        elif model == "all_models":
            return self._encode_all_models(image_array, num_jitters)
        else:
            dlib_model = "cnn" if model == "cnn" else "hog"
            locations = face_recognition.face_locations(
                image_array,
                number_of_times_to_upsample=self.upsample,
                model=dlib_model,
            )
            if not locations:
                return []
            encodings = face_recognition.face_encodings(
                image_array,
                known_face_locations=locations[: self.max_faces],
                num_jitters=num_jitters,
            )
        if not encodings:
            return []
        return [e.tolist() for e in encodings[: self.max_faces]]

    def _encode_dlib_ensemble(self, image_array: "np.ndarray", num_jitters: int = 10) -> List[List[float]]:
        """Best dlib-compatible: run CNN + HOG + OpenCV, merge, encode with dlib. 128-d."""
        all_locations: List[Tuple[int, int, int, int]] = []
        # 1. dlib CNN (most accurate)
        try:
            cnn_locs = face_recognition.face_locations(
                image_array, number_of_times_to_upsample=self.upsample, model="cnn"
            )
            all_locations.extend(cnn_locs)
        except Exception as e:
            logger.debug("CNN detection failed: %s", e)
        # 2. dlib HOG (catches faces CNN might miss)
        hog_locs = face_recognition.face_locations(
            image_array, number_of_times_to_upsample=self.upsample, model="hog"
        )
        all_locations.extend(hog_locs)
        # 3. OpenCV Haar (often catches angled/small faces)
        if OPENCV_AVAILABLE:
            haar_locs = _opencv_face_locations(image_array)
            all_locations.extend(haar_locs)
        locations = _merge_face_locations(all_locations)[: self.max_faces]
        if not locations:
            return []
        encodings = face_recognition.face_encodings(
            image_array,
            known_face_locations=locations,
            num_jitters=num_jitters,
        )
        return [e.tolist() for e in encodings[: self.max_faces]]

    def _encode_all_models(self, image_array: "np.ndarray", num_jitters: int = 10) -> List[List[float]]:
        """All 3 detection families: RetinaFace + dlib CNN + dlib HOG + OpenCV. Plus low-light & sharpen."""
        # 1. Preprocess for low light + slight blur
        enhanced = self._preprocess_image(image_array, enhance=True)
        all_locations: List[Tuple[int, int, int, int]] = []

        # 2. RetinaFace or InsightFace (best for groups, 15+ people)
        if RETINAFACE_AVAILABLE:
            try:
                resp = RetinaFace.detect_faces(enhanced)
                rf_locs = _retinaface_to_trbl(resp)
                all_locations.extend(rf_locs)
            except Exception as e:
                logger.debug("RetinaFace detection failed: %s", e)
        elif INSIGHTFACE_AVAILABLE:
            try:
                app = _get_insightface_app()
                faces = app.get(enhanced)
                for f in faces:
                    if hasattr(f, "bbox") and f.bbox is not None and len(f.bbox) >= 4:
                        x1, y1, x2, y2 = int(f.bbox[0]), int(f.bbox[1]), int(f.bbox[2]), int(f.bbox[3])
                        if x2 > x1 and y2 > y1:
                            all_locations.append((y1, x2, y2, x1))
            except Exception as e:
                logger.debug("InsightFace detection failed: %s", e)

        # 3. dlib CNN
        try:
            cnn_locs = face_recognition.face_locations(
                enhanced, number_of_times_to_upsample=self.upsample, model="cnn"
            )
            all_locations.extend(cnn_locs)
        except Exception as e:
            logger.debug("CNN detection failed: %s", e)

        # 4. dlib HOG
        hog_locs = face_recognition.face_locations(
            enhanced, number_of_times_to_upsample=self.upsample, model="hog"
        )
        all_locations.extend(hog_locs)

        # 5. OpenCV Haar
        if OPENCV_AVAILABLE:
            haar_locs = _opencv_face_locations(enhanced)
            all_locations.extend(haar_locs)

        locations = _merge_face_locations(all_locations, iou_threshold=0.4)[: self.max_faces]
        if not locations:
            return []

        encodings = face_recognition.face_encodings(
            enhanced,
            known_face_locations=locations,
            num_jitters=num_jitters,
        )
        return [e.tolist() for e in encodings[: self.max_faces]]

    def _encode_retinaface_dlib(self, image_array: "np.ndarray") -> List[List[float]]:
        """RetinaFace or InsightFace detection + dlib encoding. Best detection, 128-d dlib embeddings."""
        if not RETINAFACE_AVAILABLE and not INSIGHTFACE_AVAILABLE:
            return self._encode_dlib_ensemble(image_array, num_jitters=10)
        encodings = []
        if RETINAFACE_AVAILABLE:
            resp = RetinaFace.detect_faces(image_array)
            if isinstance(resp, dict) and "face_1" in resp:
                for i, (_, face) in enumerate(resp.items()):
                    if i >= self.max_faces:
                        break
                    box = face.get("facial_area", [])
                    if len(box) < 4:
                        continue
                    x1, y1, x2, y2 = max(0, int(box[0])), max(0, int(box[1])), int(box[2]), int(box[3])
                    face_img = image_array[y1:y2, x1:x2]
                    if face_img.size == 0:
                        continue
                    locs = face_recognition.face_locations(face_img, model="hog", number_of_times_to_upsample=1)
                    if not locs:
                        locs = face_recognition.face_locations(face_img, model="cnn", number_of_times_to_upsample=1)
                    if locs:
                        encs = face_recognition.face_encodings(face_img, known_face_locations=locs, num_jitters=5)
                        if encs:
                            encodings.append(encs[0].tolist())
        elif INSIGHTFACE_AVAILABLE:
            app = _get_insightface_app()
            faces = app.get(image_array)
            for i, f in enumerate(faces):
                if i >= self.max_faces:
                    break
                if hasattr(f, "bbox") and f.bbox is not None and len(f.bbox) >= 4:
                    x1, y1, x2, y2 = max(0, int(f.bbox[0])), max(0, int(f.bbox[1])), int(f.bbox[2]), int(f.bbox[3])
                    face_img = image_array[y1:y2, x1:x2]
                    if face_img.size == 0:
                        continue
                    locs = face_recognition.face_locations(face_img, model="hog", number_of_times_to_upsample=1)
                    if not locs:
                        locs = face_recognition.face_locations(face_img, model="cnn", number_of_times_to_upsample=1)
                    if locs:
                        encs = face_recognition.face_encodings(face_img, known_face_locations=locs, num_jitters=5)
                        if encs:
                            encodings.append(encs[0].tolist())
        if encodings:
            return encodings
        return self._encode_dlib_ensemble(image_array, num_jitters=10)

    def _encode_insightface(self, image_array: "np.ndarray") -> List[List[float]]:
        """InsightFace (RetinaFace + ArcFace), 512-d."""
        app = _get_insightface_app()
        faces = app.get(image_array)
        encodings = []
        for f in faces[: self.max_faces]:
            if hasattr(f, "embedding") and f.embedding is not None:
                encodings.append(f.embedding.tolist())
        return encodings

    def _encode_deepface(self, image_array: "np.ndarray") -> List[List[float]]:
        """DeepFace ArcFace, 512-d."""
        # DeepFace expects BGR or path; we have RGB numpy
        if OPENCV_AVAILABLE:
            bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        else:
            bgr = image_array
        objs = DeepFace.represent(bgr, model_name="ArcFace", enforce_detection=False)
        encodings = []
        for obj in objs[: self.max_faces]:
            emb = obj.get("embedding")
            if emb is not None:
                encodings.append(emb if isinstance(emb, list) else emb.tolist())
        return encodings

    def _encode_retinaface(self, image_array: "np.ndarray") -> List[List[float]]:
        """RetinaFace detection + InsightFace ArcFace for embedding, 512-d."""
        resp = RetinaFace.detect_faces(image_array)
        if not isinstance(resp, dict) or "face_1" not in resp:
            return []
        app = _get_insightface_app()
        encodings = []
        for i, (_, face) in enumerate(resp.items()):
            if i >= self.max_faces:
                break
            box = face.get("facial_area", [])
            if len(box) < 4:
                continue
            x1, y1, x2, y2 = int(box[0]), int(box[1]), int(box[2]), int(box[3])
            x1, y1 = max(0, x1), max(0, y1)
            face_img = image_array[y1:y2, x1:x2]
            if face_img.size == 0:
                continue
            faces = app.get(face_img)
            if faces and hasattr(faces[0], "embedding") and faces[0].embedding is not None:
                encodings.append(faces[0].embedding.tolist())
        return encodings

    def _encode_with_model(
        self, image_array: "np.ndarray", model: str, num_jitters: int = 5
    ) -> List[List[float]]:
        if model == "retinaface_dlib":
            return self._encode_retinaface_dlib(image_array)
        if model in ("insightface",):
            return self._encode_insightface(image_array)
        if model in ("deepface",):
            return self._encode_deepface(image_array)
        if model in ("retinaface",):
            return self._encode_retinaface(image_array)
        return self._encode_dlib(image_array, model, num_jitters)

    def _face_distance(self, encodings: List["np.ndarray"], query: "np.ndarray") -> "np.ndarray":
        """Distance from query to each encoding. Uses cosine for 512-d, L2 for 128-d."""
        use_cosine = len(query) > 128  # 512-d ArcFace embeddings
        if use_cosine:
            return np.array([_cosine_distance(e, query) for e in encodings])
        return face_recognition.face_distance(encodings, query)

    def _deduplicate_encodings(
        self, encodings: List["np.ndarray"], similarity_threshold: float = 0.98
    ) -> List["np.ndarray"]:
        if len(encodings) <= 1:
            return encodings
        unique = [encodings[0]]
        use_cosine = len(encodings[0]) > 128
        for enc in encodings[1:]:
            if use_cosine:
                dists = np.array([_cosine_distance(u, enc) for u in unique])
            else:
                dists = face_recognition.face_distance(unique, enc)
            if np.min(dists) > (1 - similarity_threshold):
                unique.append(enc)
        return unique

    def encode_from_bytes_ensemble(self, image_bytes: bytes) -> List[List[float]]:
        """Encode using configured model."""
        self._ensure_available()
        self._ensure_numpy()
        image = face_recognition.load_image_file(io.BytesIO(image_bytes))
        image = self._preprocess_image(image)
        model = self.detection_model
        # Fallback if selected model unavailable
        if model == "all_models" and not RETINAFACE_AVAILABLE and not INSIGHTFACE_AVAILABLE:
            model = "dlib_best"
        if model == "retinaface_dlib" and not RETINAFACE_AVAILABLE and not INSIGHTFACE_AVAILABLE:
            model = "dlib_best"
        if model in ("dlib_best", "all_models"):
            pass
        elif model == "opencv_haar" and not OPENCV_AVAILABLE:
            model = "cnn"
        elif model == "insightface" and not INSIGHTFACE_AVAILABLE:
            model = "dlib_best"
        elif model == "deepface" and not DEEPFACE_AVAILABLE:
            model = "dlib_best"
        elif model == "retinaface" and not (RETINAFACE_AVAILABLE and INSIGHTFACE_AVAILABLE):
            model = "dlib_best"
        try:
            encs = self._encode_with_model(image, model)
            return encs
        except Exception as e:
            logger.warning("Model %s failed: %s", model, e)
            return []

    def encode_from_array(self, image_array: "np.ndarray") -> List[List[float]]:
        self._ensure_available()
        self._ensure_numpy()
        model = self.detection_model
        if model == "all_models" and not RETINAFACE_AVAILABLE and not INSIGHTFACE_AVAILABLE:
            model = "dlib_best"
        if model == "retinaface_dlib" and not RETINAFACE_AVAILABLE and not INSIGHTFACE_AVAILABLE:
            model = "dlib_best"
        elif model == "opencv_haar" and not OPENCV_AVAILABLE:
            model = "cnn"
        encs = self._encode_with_model(self._preprocess_image(image_array), model)
        if not encs:
            return []
        unique = self._deduplicate_encodings([np.array(e) for e in encs])
        return [e.tolist() for e in unique]

    def encode_from_bytes(self, image_bytes: bytes) -> List[List[float]]:
        return self.encode_from_bytes_ensemble(image_bytes)

    def find_matches(
        self,
        query_encodings: List[List[float]],
        photo_encodings: List[List[float]],
    ) -> List[Tuple[int, float]]:
        """Match query encodings against photo encodings. Handles 128-d and 512-d."""
        self._ensure_numpy()
        if not photo_encodings or not query_encodings:
            return []
        # Check dimension compatibility
        qdim = len(query_encodings[0])
        pdim = len(photo_encodings[0])
        if qdim != pdim:
            logger.warning("Encoding dimension mismatch: query %d vs photo %d", qdim, pdim)
            return []

        best_per_face: Dict[int, float] = {}
        for qenc in query_encodings:
            query = np.array(qenc, dtype=np.float64)
            encodings = [np.array(e, dtype=np.float64) for e in photo_encodings]
            distances = self._face_distance(encodings, query)
            for i, dist in enumerate(distances):
                if dist <= self.tolerance:
                    confidence = 1.0 - (dist / self.tolerance)
                    best_per_face[i] = max(best_per_face.get(i, 0), min(1.0, confidence))

        return sorted(best_per_face.items(), key=lambda x: x[1], reverse=True)

    def detect_and_encode(self, image_path: str) -> Tuple[List[List[float]], int]:
        """For batch processing."""
        self._ensure_available()
        self._ensure_numpy()
        try:
            image = face_recognition.load_image_file(image_path)
            model = self.detection_model
            if model == "all_models" and not RETINAFACE_AVAILABLE and not INSIGHTFACE_AVAILABLE:
                model = "dlib_best"
            elif model == "retinaface_dlib" and not RETINAFACE_AVAILABLE and not INSIGHTFACE_AVAILABLE:
                model = "dlib_best"
            elif model == "opencv_haar" and not OPENCV_AVAILABLE:
                model = "cnn"
            encs = self._encode_with_model(self._preprocess_image(image), model)
            if not encs:
                return [], 0
            unique = self._deduplicate_encodings([np.array(e) for e in encs])
            return [e.tolist() for e in unique], len(unique)
        except Exception as e:
            logger.error("Face detection failed for %s: %s", image_path, e)
            raise


def get_face_service(tolerance: Optional[float] = None, model: Optional[str] = None) -> FaceRecognitionService:
    from ..config import get_settings
    s = get_settings()
    m = model or getattr(s, "FACE_DETECTION_MODEL", "hog") or "hog"
    upsample = getattr(s, "FACE_UPSAMPLE", 2)
    return FaceRecognitionService(
        tolerance=tolerance or s.FACE_MATCH_TOLERANCE,
        max_faces=s.MAX_FACES_PER_IMAGE,
        detection_model=m,
        upsample=upsample,
    )
