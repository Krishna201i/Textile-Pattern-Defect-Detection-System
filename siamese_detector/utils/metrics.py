"""
Similarity metrics for defect detection.

Provides:
    compute_ssim()          → SSIM score between two PIL images (baseline)
    classify_by_distance()  → ML decision from Euclidean distance
    classify_by_ssim()      → Baseline decision from SSIM score
    get_difference_map()    → Visual diff + bounding boxes around defects
"""

import cv2
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim_fn


# ── SSIM Baseline ─────────────────────────────────────────────────────────────

def compute_ssim(ref_img: Image.Image, test_img: Image.Image, size: int = 256) -> float:
    """
    Compute Structural Similarity Index (SSIM) between two PIL images.

    Images are resized to `size×size` and converted to grayscale.
    Returns a score in [-1, 1]; higher = more similar.
    """
    shape = (size, size)
    ref_gray  = np.array(ref_img.convert("L").resize(shape))
    test_gray = np.array(test_img.convert("L").resize(shape))
    score, _  = ssim_fn(ref_gray, test_gray, full=True)
    return float(score)


# ── Classification helpers ─────────────────────────────────────────────────────

def classify_by_distance(distance: float, threshold: float = 0.5) -> dict:
    """
    Decide defective/non-defective from Euclidean embedding distance.

    Higher distance → more different → likely defective.
    Returns dict with keys: result, confidence.
    """
    is_defective = distance > threshold
    margin       = abs(distance - threshold)
    confidence   = round(min(margin / max(threshold, 1e-6), 1.0), 4)
    return {
        "result":     "Defective" if is_defective else "Non-defective",
        "confidence": confidence,
    }


def classify_by_ssim(ssim_score: float, threshold: float = 0.80) -> dict:
    """
    Decide defective/non-defective from SSIM score.

    Lower SSIM → more different → likely defective.
    Returns dict with key: result.
    """
    return {"result": "Defective" if ssim_score < threshold else "Non-defective"}


# ── Visual difference map ─────────────────────────────────────────────────────

def get_difference_map(ref_img: Image.Image, test_img: Image.Image, size: int = 256) -> dict:
    """
    Generate a heatmap of differences and find bounding boxes around defects.

    Returns:
        diff_image  : PIL image (JET heatmap of difference)
        bboxes      : list of {"x", "y", "w", "h"} dicts for each defect region
    """
    shape    = (size, size)
    ref_gray = np.array(ref_img.convert("L").resize(shape))
    test_gray= np.array(test_img.convert("L").resize(shape))

    # SSIM difference map: values close to 1 = similar, close to 0 = different
    _, diff = ssim_fn(ref_gray, test_gray, full=True)
    diff_u8 = (diff * 255).astype(np.uint8)

    # Threshold to isolate defect regions
    _, thresh = cv2.threshold(diff_u8, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Find contours (groups of differing pixels)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    bboxes = [
        {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
        for cnt in contours
        if cv2.contourArea(cnt) > 30
        for x, y, w, h in [cv2.boundingRect(cnt)]
    ]

    # Build JET heatmap: brighter red = more different
    heatmap = cv2.applyColorMap(255 - diff_u8, cv2.COLORMAP_JET)
    diff_pil = Image.fromarray(cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB))

    return {"diff_image": diff_pil, "bboxes": bboxes}
