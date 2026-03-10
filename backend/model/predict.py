"""
Prediction module for textile defect detection.
Loads the trained model and classifies fabric images.
"""

import os
import hashlib
import numpy as np
from tensorflow.keras.models import load_model
from .preprocess import preprocess_single_image

try:
    import cv2
except Exception:
    cv2 = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "saved_model", "textile_defect_model.keras")
DEFECT_THRESHOLD = float(os.environ.get("DEFECT_THRESHOLD", "0.60"))

# Class labels matching the directory names (alphabetical order)
CLASS_LABELS = {0: "defective", 1: "non_defective"}

_model = None


def _normalized_defect_threshold() -> float:
    return float(max(0.01, min(0.99, DEFECT_THRESHOLD)))


def get_model():
    """Load the trained model (cached after first load).
    If the model file does not exist, do not raise here — return None so callers can
    handle the absence gracefully.
    """
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            # Do not raise here; log and keep _model as None
            print(f"Warning: Trained model not found at {MODEL_PATH}.")
            _model = None
            return None
        _model = load_model(MODEL_PATH)
    return _model


def get_system_diagnostics() -> dict:
    """Return lightweight runtime diagnostics for model and CV availability."""
    model_exists = os.path.exists(MODEL_PATH)
    model_loaded = _model is not None
    return {
        "model_path": MODEL_PATH,
        "model_exists": model_exists,
        "model_loaded": model_loaded,
        "cv_available": cv2 is not None,
        "pipeline": "cnn_cv_hybrid" if model_exists else "mock",
        "defect_threshold": round(_normalized_defect_threshold(), 4),
    }


def _deterministic_mock_prediction(image_path: str) -> dict:
    """Create a deterministic pseudo-prediction based on the image path.

    This allows end-to-end UI testing without a trained model. The value is
    reproducible for the same image_path (hash-based).
    """
    # Use a stable hash of the path to generate a value in [0, 1]
    key = (image_path or "").encode('utf-8')
    h = hashlib.sha256(key).hexdigest()
    # Use first 8 hex digits -> an integer in [0, 2^32-1]
    v = int(h[:8], 16)
    probability = float(v) / float(0xFFFFFFFF)

    # Interpret probability: close to 0 => defective, close to 1 => non_defective
    defect_prob = 1.0 - probability
    threshold = _normalized_defect_threshold()
    label = CLASS_LABELS[0] if defect_prob >= threshold else CLASS_LABELS[1]
    confidence = defect_prob if label == CLASS_LABELS[0] else probability

    return {
        "model_available": False,
        "mock": True,
        "pipeline": "mock",
        "label": label,
        "confidence": round(confidence * 100, 2),
        "defect_probability": round(defect_prob * 100, 2),
        "defect_threshold": round(threshold * 100, 2),
        "note": "deterministic mock prediction (no trained model present)",
    }


def _compute_cv_defect_probability(image_path: str) -> tuple[float, dict]:
    """Estimate defect probability from classical CV features.

    Returns a tuple of (probability, diagnostics), where probability is in [0, 1].
    """
    if cv2 is None:
        return 0.5, {"cv_available": False, "reason": "opencv_not_installed"}

    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        return 0.5, {"cv_available": False, "reason": "image_load_failed"}

    image = cv2.GaussianBlur(image, (3, 3), 0)

    laplacian = cv2.Laplacian(image, cv2.CV_64F)
    laplacian_var = float(np.var(np.abs(laplacian)))

    edges = cv2.Canny(image, 80, 160)
    edge_density = float(np.count_nonzero(edges)) / float(edges.size)

    normalized_texture = min(laplacian_var / 1800.0, 1.0)
    normalized_edges = min(edge_density / 0.22, 1.0)
    cv_prob = (0.65 * normalized_texture) + (0.35 * normalized_edges)
    cv_prob = float(max(0.0, min(1.0, cv_prob)))

    return cv_prob, {
        "cv_available": True,
        "laplacian_variance": round(laplacian_var, 4),
        "edge_density": round(edge_density, 4),
        "texture_score": round(normalized_texture, 4),
        "edge_score": round(normalized_edges, 4),
    }


def predict_image(image_path):
    """
    Predict whether a fabric image is defective or non-defective.

    If a trained model is not available, return a deterministic mock response so the
    frontend can be exercised end-to-end.
    """
    model = get_model()
    if model is None:
        # Return a deterministic mock prediction (do not raise) so UI/test flows work
        try:
            return _deterministic_mock_prediction(image_path)
        except Exception:
            # Last-resort fallback — keep response shape stable
            return {
                "model_available": False,
                "mock": True,
                "label": "unknown",
                "confidence": 0.0,
                "defect_probability": 0.0,
                "note": "mock predictor failed",
            }

    processed = preprocess_single_image(image_path)
    prediction = model.predict(processed, verbose=0)
    cnn_non_defective_prob = float(prediction[0][0])
    cnn_non_defective_prob = float(max(0.0, min(1.0, cnn_non_defective_prob)))
    cnn_defect_prob = 1.0 - cnn_non_defective_prob

    cv_defect_prob, cv_details = _compute_cv_defect_probability(image_path)

    hybrid_defect_prob = (0.75 * cnn_defect_prob) + (0.25 * cv_defect_prob)
    hybrid_defect_prob = float(max(0.0, min(1.0, hybrid_defect_prob)))

    non_defective_prob = 1.0 - hybrid_defect_prob
    threshold = _normalized_defect_threshold()
    label = CLASS_LABELS[0] if hybrid_defect_prob >= threshold else CLASS_LABELS[1]
    confidence = hybrid_defect_prob if label == CLASS_LABELS[0] else non_defective_prob

    return {
        "model_available": True,
        "pipeline": "cnn_cv_hybrid",
        "label": label,
        "confidence": round(confidence * 100, 2),
        "defect_probability": round(hybrid_defect_prob * 100, 2),
        "defect_threshold": round(threshold * 100, 2),
        "cnn_defect_probability": round(cnn_defect_prob * 100, 2),
        "cv_defect_probability": round(cv_defect_prob * 100, 2),
        "cv_details": cv_details,
    }
