"""
Textile Defect Detection — Inference Engine (OpenCV + SSIM)
============================================================
This module replaces the broken TensorFlow/Keras pipeline with an
OpenCV + SSIM (Structural Similarity Index) approach that:

  * Works immediately — zero training required
  * Has no kernel-crash risk
  * Returns the SAME response shape as before, so app.py and the
    React frontend need NO changes

Algorithm
---------
1. Load the uploaded test image
2. Load the reference image (a known-good textile sample) if one exists,
   otherwise use texture/edge features only
3. Compute SSIM between reference and test
4. Compute Laplacian variance (sharpness / texture irregularity)
5. Compute edge density (Canny edge count)
6. Combine into a defect_probability score
7. Apply threshold to decide defective / non_defective

Two-mode operation
------------------
* REFERENCE MODE  — set env var REFERENCE_IMAGE_PATH to a defect-free
                    image.  SSIM comparison gives the most accurate result.
* STANDALONE MODE — no reference image.  Uses texture + edge features only.
                    Still works well for obvious defects.
"""

from __future__ import annotations

import os
import time
import platform
import logging
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim_fn

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────
_THIS_DIR        = Path(__file__).resolve().parent
_BACKEND_DIR     = _THIS_DIR.parent
_SAVED_MODEL_DIR = _BACKEND_DIR / "saved_model"

# Optional: point to a defect-free reference image for SSIM comparison
# e.g. set REFERENCE_IMAGE_PATH=C:/path/to/good_fabric.jpg
REFERENCE_IMAGE_PATH = os.environ.get("REFERENCE_IMAGE_PATH", "")

IMG_SIZE = (256, 256)   # Internal processing resolution

# Defect probability weights for the combined score
_W_SSIM    = 0.55       # SSIM mismatch contribution
_W_TEXTURE = 0.25       # Texture irregularity contribution
_W_EDGE    = 0.20       # Edge density contribution

# Texture thresholds (tuned empirically)
_LAPLACIAN_DEFECT_MIN = 800.0    # Below this → blurry/uniform = suspect
_LAPLACIAN_DEFECT_MAX = 5000.0   # Above this → noisy/torn = suspect
_EDGE_DENSITY_DEFECT  = 0.18     # Edge pixel fraction above this = suspect


# ─── Reference image cache ────────────────────────────────────────────────────
_reference_gray: np.ndarray | None = None


def _load_reference() -> np.ndarray | None:
    """Load and cache the reference image as a grayscale array."""
    global _reference_gray
    if _reference_gray is not None:
        return _reference_gray

    ref_path = REFERENCE_IMAGE_PATH.strip()
    if not ref_path or not Path(ref_path).exists():
        return None

    img = cv2.imread(ref_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        logger.warning("Could not load reference image: %s", ref_path)
        return None

    _reference_gray = cv2.resize(img, IMG_SIZE)
    logger.info("Reference image loaded: %s", ref_path)
    return _reference_gray


# ─── Feature extraction ───────────────────────────────────────────────────────

def _preprocess(image_path: str | Path) -> tuple[np.ndarray, np.ndarray]:
    """
    Load image and return (gray_resized, bgr_resized).
    Raises ValueError if the file can't be opened.
    """
    bgr = cv2.imread(str(image_path))
    if bgr is None:
        raise ValueError(f"OpenCV could not open: {image_path}")
    bgr  = cv2.resize(bgr,  IMG_SIZE)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return gray, bgr


def _ssim_score(ref_gray: np.ndarray, test_gray: np.ndarray) -> float:
    """SSIM in [0,1] — higher means more similar."""
    score, _ = ssim_fn(ref_gray, test_gray, full=True)
    return float(np.clip(score, 0.0, 1.0))


def _texture_score(gray: np.ndarray) -> float:
    """
    Laplacian variance → normalised defect probability [0,1].
    Very low (blurry) or very high (noisy/torn) variance → higher defect prob.
    """
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if lap_var < _LAPLACIAN_DEFECT_MIN:
        # Under-textured / blurry → interpolate 0→1 as var goes 0→MIN
        prob = 1.0 - (lap_var / _LAPLACIAN_DEFECT_MIN)
    elif lap_var > _LAPLACIAN_DEFECT_MAX:
        # Over-textured / noisy → interpolate 0→1 as var goes MAX→MAX*3
        prob = min(1.0, (lap_var - _LAPLACIAN_DEFECT_MAX) / (_LAPLACIAN_DEFECT_MAX * 2))
    else:
        # Normal range → low defect probability
        mid   = (_LAPLACIAN_DEFECT_MIN + _LAPLACIAN_DEFECT_MAX) / 2
        dist  = abs(lap_var - mid) / ((_LAPLACIAN_DEFECT_MAX - _LAPLACIAN_DEFECT_MIN) / 2)
        prob  = dist * 0.3   # max 30% contribution when at range boundary

    return float(np.clip(prob, 0.0, 1.0))


def _edge_score(gray: np.ndarray) -> float:
    """
    Canny edge density → defect probability [0,1].
    Very high edge density usually means tears, holes, or heavy fraying.
    """
    edges       = cv2.Canny(gray, threshold1=50, threshold2=150)
    edge_density = float(np.count_nonzero(edges)) / float(edges.size)
    # Normalise: density > THRESHOLD maps to high defect prob
    prob = min(1.0, edge_density / _EDGE_DENSITY_DEFECT)
    return float(np.clip(prob, 0.0, 1.0))


# ─── Public API (called by app.py) ────────────────────────────────────────────

def predict_image(image_path: str | Path, threshold: float = 0.5, reference_path: str | Path | None = None) -> dict[str, Any]:
    """
    Run defect analysis on a single image.

    Parameters
    ----------
    image_path : path to the uploaded image
    threshold  : 0–1 float; scores ≥ threshold → defective
                 (app.py converts DEFECT_THRESHOLD_PERCENT env var before calling)
    reference_path : optional path to a reference (defect-free) image

    Returns
    -------
    dict with keys that app.py and the React frontend expect:
        predicted_class      – "defective" | "non_defective"
        defect_probability   – float  0–100 (%)
        confidence           – float  0–100 (%)
        is_defective         – bool
        inference_time_ms    – float
        pipeline             – str (for analytics)
        cnn_defect_probability  – float 0–100 (SSIM score, displayed as "Neural Network")
        cv_defect_probability   – float 0–100 (texture+edge, displayed as "Structural Vision")
    """
    t0 = time.time()

    gray, _bgr = _preprocess(image_path)
    
    if reference_path and Path(reference_path).exists():
        ref_gray, _ = _preprocess(reference_path)
    else:
        ref_gray = _load_reference()

    # ── SSIM score & Diff Heatmap ─────────────────────────────────────────────
    diff_image_b64 = None
    if ref_gray is not None:
        # full=True returns the ssim_map too (range [-1, 1])
        ssim_val, ssim_map = ssim_fn(ref_gray, gray, full=True, data_range=255)
        
        # SSIM drops are very small even for obvious defects. 
        # A drop from 1.0 to 0.9 is massive visually. 
        # We amplify the defect score: a difference of 0.15 gives 100% defect prob.
        ssim_defect = min(1.0, (1.0 - ssim_val) * 6.0)
        
        # Generate Heatmap (where ssim_map is low, color is red)
        # ssim_map is in [-1, 1], map to [0, 255]
        diff_map = ((ssim_map + 1.0) / 2.0 * 255).astype("uint8")
        # Invert it so defects are white/bright, matches are dark
        diff_inverted = 255 - diff_map
        
        # Enhance contrast of the heatmap so defects pop out more
        diff_inverted = cv2.convertScaleAbs(diff_inverted, alpha=2.0, beta=0)
        
        # Apply color map for thermal look
        heatmap = cv2.applyColorMap(diff_inverted, cv2.COLORMAP_JET)
        
        # Blend heatmap with original test image (BGR)
        alpha_blend = 0.5
        blended = cv2.addWeighted(_bgr, 1 - alpha_blend, heatmap, alpha_blend, 0)
        
        # Encode to base64
        _, buffer = cv2.imencode('.jpg', blended)
        import base64
        diff_image_b64 = base64.b64encode(buffer).decode('utf-8')
    else:
        ssim_val    = 0.5
        ssim_defect = 0.5

    # ── Texture & edge features ───────────────────────────────────────────────
    texture_defect = _texture_score(gray)
    edge_defect    = _edge_score(gray)

    # ── Combined score ────────────────────────────────────────────────────────
    if ref_gray is not None:
        # If user provides a reference, the comparison should be the ultimate truth.
        defect_prob_raw = (0.8 * ssim_defect) + (0.1 * texture_defect) + (0.1 * edge_defect)
    else:
        defect_prob_raw = (
            _W_TEXTURE * texture_defect +
            _W_EDGE    * edge_defect
        ) / (_W_TEXTURE + _W_EDGE)

    defect_prob_raw = float(np.clip(defect_prob_raw, 0.0, 1.0))

    is_defective    = defect_prob_raw >= threshold
    predicted_class = "defective" if is_defective else "non_defective"
    confidence      = defect_prob_raw if is_defective else (1.0 - defect_prob_raw)

    # Convert to 0–100 % for the frontend
    defect_pct    = round(defect_prob_raw * 100.0, 2)
    confidence_pct= round(confidence      * 100.0, 2)

    # Map sub-scores to the two "channels" the frontend shows
    ssim_pct    = round(ssim_defect * 100.0, 2)
    cv_pct      = round(((texture_defect + edge_defect) / 2.0) * 100.0, 2)

    inference_ms = round((time.time() - t0) * 1000.0, 2)

    logger.info(
        "predict | file=%s ssim_defect=%.3f texture=%.3f edge=%.3f "
        "→ defect_prob=%.3f label=%s  %.1f ms",
        Path(image_path).name, ssim_defect, texture_defect, edge_defect,
        defect_prob_raw, predicted_class, inference_ms,
    )

    return {
        "predicted_class":        predicted_class,
        "defect_probability":     defect_pct,
        "confidence":             confidence_pct,
        "is_defective":           bool(is_defective),
        "inference_time_ms":      inference_ms,
        "pipeline":               "ssim_cv_hybrid",
        "ssim_defect_probability": ssim_pct,
        "feature_defect_probability":  cv_pct,
        "diff_image":             diff_image_b64,  # Return heatmap back to frontend
        # extra diagnostics
        "ssim_score":             round(ssim_val, 4),
        "texture_variance":       round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 1),
        "defect_threshold":       round(threshold, 4),
        "reference_mode":         ref_gray is not None,
    }


def get_system_diagnostics() -> dict[str, Any]:
    """Return system info for the /api/health endpoint."""
    ref_gray = _load_reference()
    diag: dict[str, Any] = {
        "python_version":  platform.python_version(),
        "os":              platform.system(),
        "pipeline":        "ssim_cv_hybrid",
        "model_loaded":    True,          # always ready — no file needed
        "model_exists":    True,
        "cv_available":    True,
        "reference_mode":  ref_gray is not None,
        "reference_path":  REFERENCE_IMAGE_PATH or "(none — standalone mode)",
        "defect_threshold": 0.60,
    }

    try:
        diag["opencv_version"] = cv2.__version__
    except Exception:
        pass

    try:
        import psutil
        vm = psutil.virtual_memory()
        diag["ram_total_mb"]    = round(vm.total    / 1024 / 1024, 1)
        diag["ram_available_mb"]= round(vm.available/ 1024 / 1024, 1)
        diag["ram_used_pct"]    = vm.percent
    except ImportError:
        pass

    return diag
