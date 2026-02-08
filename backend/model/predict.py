"""
Prediction module for textile defect detection.
Loads the trained model and classifies fabric images.
"""

import os
import numpy as np
from tensorflow.keras.models import load_model
from .preprocess import preprocess_single_image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "saved_model", "textile_defect_model.keras")

# Class labels matching the directory names (alphabetical order)
CLASS_LABELS = {0: "defective", 1: "non_defective"}

_model = None


def get_model():
    """Load the trained model (cached after first load)."""
    global _model
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Trained model not found at {MODEL_PATH}. "
                "Please run train.py first."
            )
        _model = load_model(MODEL_PATH)
    return _model


def predict_image(image_path):
    """
    Predict whether a fabric image is defective or non-defective.

    Args:
        image_path: Path to the fabric image.

    Returns:
        dict with keys: label, confidence, defect_probability
    """
    model = get_model()
    processed = preprocess_single_image(image_path)
    prediction = model.predict(processed, verbose=0)
    probability = float(prediction[0][0])

    # sigmoid output: close to 0 = defective, close to 1 = non_defective
    label = CLASS_LABELS[1] if probability >= 0.5 else CLASS_LABELS[0]
    confidence = probability if probability >= 0.5 else 1 - probability

    return {
        "label": label,
        "confidence": round(confidence * 100, 2),
        "defect_probability": round((1 - probability) * 100, 2),
    }
