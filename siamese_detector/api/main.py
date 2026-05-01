"""
FastAPI backend for Textile Defect Detection.

Endpoints:
    GET  /          → Health check + model status
    GET  /config    → Current threshold settings
    POST /predict   → Upload reference + test images → defect analysis

Run:
    cd siamese_detector
    uvicorn api.main:app --reload --port 8000
"""

import io
import logging
import os
import sys
from pathlib import Path

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

# ── Make parent importable ────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.siamese_model import SiameseNetwork, euclidean_distance
from utils.preprocess     import preprocess_pil
from utils.metrics        import (
    compute_ssim,
    classify_by_distance,
    classify_by_ssim,
    get_difference_map,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ── Device & paths ────────────────────────────────────────────────────────────
DEVICE             = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH         = Path(os.getenv("MODEL_PATH", "checkpoints/siamese_best.pt"))
DISTANCE_THRESHOLD = float(os.getenv("DISTANCE_THRESHOLD", "0.5"))
SSIM_THRESHOLD     = float(os.getenv("SSIM_THRESHOLD", "0.80"))

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/bmp", "image/webp", "image/tiff"}

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Textile Defect Detection API",
    description = "Siamese Neural Network + SSIM based textile defect detection",
    version     = "1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ── Model singleton ───────────────────────────────────────────────────────────
_model: SiameseNetwork | None = None


def get_model() -> SiameseNetwork:
    global _model
    if _model is None:
        _model = SiameseNetwork(embedding_dim=128, pretrained=True).to(DEVICE)
        if MODEL_PATH.exists():
            _model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
            log.info(f"Loaded trained weights from {MODEL_PATH}")
        else:
            log.warning(
                f"No checkpoint at {MODEL_PATH}. "
                "Using pretrained ImageNet features — run train.py for better accuracy."
            )
        _model.eval()
    return _model


@app.on_event("startup")
def startup():
    get_model()
    log.info(f"API ready on device={DEVICE}")


# ── Response schema ───────────────────────────────────────────────────────────

class PredictionResponse(BaseModel):
    distance:           float   # Euclidean distance between embeddings
    ssim_score:         float   # SSIM baseline score (0–1, higher = similar)
    ml_result:          str     # Decision from Siamese network
    ssim_result:        str     # Decision from SSIM baseline
    final_result:       str     # Combined final verdict
    confidence:         float   # How far prediction is from the threshold
    defect_regions:     int     # Number of distinct defect areas found
    distance_threshold: float
    ssim_threshold:     float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/", summary="Health check")
def health():
    return {
        "status":       "ok",
        "device":       str(DEVICE),
        "model_loaded": MODEL_PATH.exists(),
    }


@app.get("/config", summary="Current thresholds")
def config():
    return {
        "distance_threshold": DISTANCE_THRESHOLD,
        "ssim_threshold":     SSIM_THRESHOLD,
        "model_path":         str(MODEL_PATH),
        "device":             str(DEVICE),
    }


@app.post("/predict", response_model=PredictionResponse, summary="Detect textile defects")
async def predict(
    reference:          UploadFile = File(...,       description="Reference (defect-free) image"),
    test:               UploadFile = File(...,       description="Test image to inspect"),
    distance_threshold: float      = Form(default=0.5,  description="Euclidean distance threshold"),
    ssim_threshold:     float      = Form(default=0.80, description="SSIM threshold"),
):
    """
    Compare a reference textile image against a test image.

    Returns:
    - **distance**: Siamese embedding distance (lower = more similar)
    - **ssim_score**: SSIM score (higher = more similar)
    - **ml_result / ssim_result**: Individual model decisions
    - **final_result**: Combined verdict — "Defective" or "Non-defective"
    - **defect_regions**: Number of highlighted defect areas
    """
    # Validate content types
    for f in (reference, test):
        if f.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, f"Unsupported type: {f.content_type}")

    try:
        # Read images ─────────────────────────────────────────────────────────
        ref_pil  = Image.open(io.BytesIO(await reference.read())).convert("RGB")
        test_pil = Image.open(io.BytesIO(await test.read())).convert("RGB")

        # 1. Siamese Network inference ─────────────────────────────────────────
        model = get_model()
        ref_t, test_t = preprocess_pil(ref_pil, DEVICE), preprocess_pil(test_pil, DEVICE)

        with torch.no_grad():
            e1, e2 = model(ref_t, test_t)
            dist   = euclidean_distance(e1, e2).item()

        ml_dec   = classify_by_distance(dist, distance_threshold)

        # 2. SSIM baseline ─────────────────────────────────────────────────────
        ssim_score = compute_ssim(ref_pil, test_pil)
        ssim_dec   = classify_by_ssim(ssim_score, ssim_threshold)

        # 3. Difference map ───────────────────────────────────────────────────
        diff_data = get_difference_map(ref_pil, test_pil)

        # 4. Combined decision: if both agree → confident; else fall back to SSIM
        final = (
            ml_dec["result"]
            if ml_dec["result"] == ssim_dec["result"]
            else ssim_dec["result"]
        )

        log.info(
            f"dist={dist:.4f} ssim={ssim_score:.4f} "
            f"ML={ml_dec['result']} SSIM={ssim_dec['result']} → {final}"
        )

        return PredictionResponse(
            distance           = round(dist, 4),
            ssim_score         = round(ssim_score, 4),
            ml_result          = ml_dec["result"],
            ssim_result        = ssim_dec["result"],
            final_result       = final,
            confidence         = ml_dec["confidence"],
            defect_regions     = len(diff_data["bboxes"]),
            distance_threshold = distance_threshold,
            ssim_threshold     = ssim_threshold,
        )

    except HTTPException:
        raise
    except Exception as exc:
        log.exception("Prediction failed")
        raise HTTPException(500, str(exc))
