"""
Prediction module for textile defect detection.
Loads the trained model and classifies fabric images.
"""

import os
import hashlib
import numpy as np
from tensorflow.keras.models import load_model
from .preprocess import preprocess_single_image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "saved_model", "textile_defect_model.keras")

# Class labels matching the directory names (alphabetical order)
CLASS_LABELS = {0: "defective", 1: "non_defective"}

_model = None


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
    label = CLASS_LABELS[1] if probability >= 0.5 else CLASS_LABELS[0]
    confidence = probability if probability >= 0.5 else 1.0 - probability

    return {
        "model_available": False,
        "mock": True,
        "label": label,
        "confidence": round(confidence * 100, 2),
        "defect_probability": round((1.0 - probability) * 100, 2),
        "note": "deterministic mock prediction (no trained model present)",
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
    probability = float(prediction[0][0])

    # sigmoid output: close to 0 = defective, close to 1 = non_defective
    label = CLASS_LABELS[1] if probability >= 0.5 else CLASS_LABELS[0]
    confidence = probability if probability >= 0.5 else 1 - probability

    return {
        "model_available": True,
        "label": label,
        "confidence": round(confidence * 100, 2),
        "defect_probability": round((1 - probability) * 100, 2),
    }
