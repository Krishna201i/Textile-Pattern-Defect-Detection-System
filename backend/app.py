"""
Flask API server for the Textile Defect Detection System.
Provides endpoints for image upload and defect prediction.
"""

import os
import time
import uuid
import logging
import threading
from collections import defaultdict, deque
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError
import psutil
from model.predict import predict_image, get_system_diagnostics

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.environ.get("CORS_ORIGINS", "*")}})
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tiff"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_UPLOAD_MB", "16")) * 1024 * 1024

# Path to frontend build (Vite `dist`) — sibling folder to backend
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist"))

RATE_LIMIT_WINDOW_SEC = int(os.environ.get("PREDICT_RATE_WINDOW_SEC", "60"))
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get("PREDICT_RATE_MAX_REQUESTS", "30"))
_PREDICT_RATE_BUCKETS: dict[str, deque] = defaultdict(deque)
_RATE_LOCK = threading.Lock()

DEFECT_THRESHOLD_PERCENT = float(os.environ.get("DEFECT_THRESHOLD_PERCENT", "60"))

# Global metrics for /api/performance
_SERVER_START_TIME = time.time()
_METRICS = {
    "total_requests": 0,
    "total_errors": 0,
    "latency_history": deque(maxlen=100) # Keep last 100 requests for quick average
}
_METRICS_LOCK = threading.Lock()

def _json_error(
    message: str,
    status_code: int,
    *,
    code: str | None = None,
    hint: str | None = None,
    details: dict | None = None,
):
    """Build a structured, descriptive JSON error response.

    Fields:
      success    — always False
      error      — human-readable summary of what went wrong
      code       — machine-readable error code for client-side handling
      hint       — actionable suggestion for the caller to fix the issue
      details    — optional extra diagnostic context (file sizes, types, etc.)
      request_id — echo of X-Request-ID for log correlation
    """
    payload: dict = {
        "success": False,
        "error": message,
        "request_id": getattr(g, "request_id", None),
    }
    if code:
        payload["code"] = code
    if hint:
        payload["hint"] = hint
    if details:
        payload["details"] = details
    return jsonify(payload), status_code


def _get_client_ip() -> str:
    forwarded_for = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    return request.remote_addr or "unknown"


def _check_predict_rate_limit() -> tuple[bool, int]:
    now = time.time()
    ip = _get_client_ip()
    with _RATE_LOCK:
        bucket = _PREDICT_RATE_BUCKETS[ip]
        while bucket and (now - bucket[0]) > RATE_LIMIT_WINDOW_SEC:
            bucket.popleft()

        if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
            retry_after = int(max(1, RATE_LIMIT_WINDOW_SEC - (now - bucket[0])))
            return False, retry_after

        bucket.append(now)
        return True, 0


def _to_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return float(default)

def allowed_file(filename: str) -> bool:
    """Return True only when the filename has an allowed image extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _get_extension(filename: str) -> str:
    """Return the lowercased extension (without leading dot), or empty string."""
    parts = filename.rsplit(".", 1)
    return parts[1].lower() if len(parts) == 2 else ""


def _validate_image_file(filepath: str) -> None:
    """Verify that the saved file is a real, readable image.

    Raises:
        ValueError — with a descriptive message if the file is corrupt,
                     truncated, or not an image at all.
    """
    try:
        with Image.open(filepath) as img:
            img.verify()
    except UnidentifiedImageError:
        raise ValueError(
            "The uploaded file could not be identified as an image. "
            "Make sure you are sending a real image file, not a renamed document or archive."
        )
    except OSError as exc:
        raise ValueError(
            f"The uploaded file appears to be corrupt or truncated and cannot be read ({exc}). "
            "Please re-export or re-save the image and try again."
        )
    except ValueError as exc:
        raise ValueError(
            f"Image validation failed: {exc}. "
            "The file may be incomplete or in an unsupported sub-format."
        )


def _clamp_percent(value, default=0.0):
    value = _to_float(value, default)
    return float(max(0.0, min(100.0, value)))


def _normalized_threshold_percent() -> float:
    return float(max(1.0, min(99.0, DEFECT_THRESHOLD_PERCENT)))


@app.before_request
def before_request():
    g.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    g.started_at = time.perf_counter()


@app.after_request
def after_request(response):
    response.headers["X-Request-ID"] = getattr(g, "request_id", "")
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    
    elapsed_ms = round((time.perf_counter() - getattr(g, "started_at", time.perf_counter())) * 1000.0, 2)
    response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
    
    # Track metrics
    with _METRICS_LOCK:
        _METRICS["total_requests"] += 1
        _METRICS["latency_history"].append(elapsed_ms)
        if response.status_code >= 400:
            _METRICS["total_errors"] += 1
            
    return response


@app.errorhandler(413)
def payload_too_large(_error):
    max_mb = app.config.get("MAX_CONTENT_LENGTH", 0) // (1024 * 1024)
    return _json_error(
        f"The uploaded file exceeds the maximum allowed size of {max_mb} MB.",
        413,
        code="payload_too_large",
        hint=f"Compress or resize your image so it is smaller than {max_mb} MB, then try again.",
        details={"max_upload_mb": max_mb},
    )


@app.errorhandler(400)
def bad_request(error):
    # Werkzeug populates error.description with a human-readable reason when available
    description = getattr(error, "description", None) or "The request could not be understood by the server."
    return _json_error(
        str(description),
        400,
        code="bad_request",
        hint="Check your request format, headers, and payload, then try again.",
    )


@app.errorhandler(404)
def not_found(_error):
    return _json_error(
        f"The requested endpoint '{request.path}' does not exist.",
        404,
        code="not_found",
        hint="Check the API documentation for the list of valid endpoints.",
        details={"path": request.path, "method": request.method},
    )


@app.errorhandler(405)
def method_not_allowed(error):
    allowed = getattr(error, "valid_methods", None)
    return _json_error(
        f"HTTP method '{request.method}' is not allowed for '{request.path}'.",
        405,
        code="method_not_allowed",
        hint=f"Use one of the allowed methods: {', '.join(sorted(allowed))}" if allowed else
             "Check the API documentation for the correct HTTP method.",
        details={"method_used": request.method, "allowed_methods": list(allowed) if allowed else []},
    )


@app.errorhandler(429)
def too_many_requests(error):
    description = getattr(error, "description", "Too many requests.")
    return _json_error(
        str(description),
        429,
        code="rate_limited",
        hint=f"You have exceeded the rate limit ({RATE_LIMIT_MAX_REQUESTS} requests per {RATE_LIMIT_WINDOW_SEC}s). "
             "Wait a moment before retrying.",
        details={"limit": RATE_LIMIT_MAX_REQUESTS, "window_seconds": RATE_LIMIT_WINDOW_SEC},
    )


@app.errorhandler(500)
def internal_server_error(error):
    logger.exception("Unhandled server error — request_id=%s path=%s",
                     getattr(g, "request_id", "?"), request.path)
    return _json_error(
        "An unexpected error occurred on the server. The issue has been logged.",
        500,
        code="internal_error",
        hint="This is a server-side problem. Please try again in a moment. "
             "If the error persists, contact the system administrator and provide the request_id.",
        details={"path": request.path, "method": request.method},
    )


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    diagnostics = get_system_diagnostics()
    return jsonify({
        "status": "ok",
        "message": "Server is running",
        "diagnostics": diagnostics,
    })


@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Accept a fabric image and return defect prediction.

    Expects: multipart/form-data with an 'image' field.
    Returns: JSON with label, confidence, and defect_probability.
    """
    # ── Rate limit check ────────────────────────────────────────────────────
    allowed, retry_after = _check_predict_rate_limit()
    if not allowed:
        return _json_error(
            f"Too many prediction requests. You have sent more than {RATE_LIMIT_MAX_REQUESTS} "
            f"requests in the last {RATE_LIMIT_WINDOW_SEC} seconds.",
            429,
            code="rate_limited",
            hint=f"Wait {retry_after} second(s) before retrying.",
            details={
                "retry_after_seconds": retry_after,
                "limit": RATE_LIMIT_MAX_REQUESTS,
                "window_seconds": RATE_LIMIT_WINDOW_SEC,
            },
        )

    # ── Upload validation ────────────────────────────────────────────────────
    if "image" not in request.files:
        return _json_error(
            "No image file was included in the request.",
            400,
            code="missing_image",
            hint="Send the image as multipart/form-data with the field name 'image'. "
                 "Example: curl -F 'image=@photo.jpg' http://localhost:5000/api/predict",
            details={"expected_field": "image", "content_type": request.content_type},
        )

    file = request.files["image"]
    if not file or file.filename == "":
        return _json_error(
            "The 'image' field was present but no file was attached.",
            400,
            code="missing_filename",
            hint="Make sure a file is selected/attached before submitting. "
                 "The file field cannot be empty.",
        )

    ext = _get_extension(file.filename)
    if not allowed_file(file.filename):
        return _json_error(
            f"File type '.{ext}' is not supported for defect analysis.",
            400,
            code="invalid_extension",
            hint=f"Upload an image in one of the supported formats: "
                 f"{', '.join(f'.{e}' for e in sorted(ALLOWED_EXTENSIONS))}.",
            details={
                "received_extension": f".{ext}" if ext else "(none)",
                "allowed_extensions": sorted(ALLOWED_EXTENSIONS),
            },
        )

    # ── Save file to disk ────────────────────────────────────────────────────
    request_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    safe_ext = os.path.splitext(filename)[1]
    temp_name = f"{request_id}{safe_ext}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], temp_name)
    started_at = time.perf_counter()

    try:
        file.save(filepath)
    except OSError as exc:
        logger.error("Failed to save uploaded file request_id=%s: %s", request_id, exc)
        return _json_error(
            "The server could not save the uploaded file due to a storage error.",
            500,
            code="upload_save_failed",
            hint="This is a server-side storage issue. Please try again. "
                 "If the problem persists, contact the administrator.",
            details={"request_id": request_id},
        )

    # ── Save optional reference file ─────────────────────────────────────────
    ref_filepath = None
    if "reference" in request.files:
        ref_file = request.files["reference"]
        if ref_file and ref_file.filename != "":
            if allowed_file(ref_file.filename):
                ref_ext = os.path.splitext(secure_filename(ref_file.filename))[1]
                ref_temp_name = f"{request_id}_ref{ref_ext}"
                ref_filepath = os.path.join(app.config["UPLOAD_FOLDER"], ref_temp_name)
                try:
                    ref_file.save(ref_filepath)
                    _validate_image_file(ref_filepath)
                except Exception as exc:
                    logger.warning("Failed to save or validate reference file: %s", exc)
                    ref_filepath = None

    # ── Run prediction ───────────────────────────────────────────────────────
    try:
        _validate_image_file(filepath)
        result = predict_image(filepath, reference_path=ref_filepath)
        defect_prob = _clamp_percent(result.get("defect_probability", 0.0))
        threshold_percent = _normalized_threshold_percent()

        if defect_prob >= threshold_percent:
            result["label"] = "defective"
            result["confidence"] = defect_prob
        else:
            result["label"] = "non_defective"
            result["confidence"] = round(100.0 - defect_prob, 2)

        result["defect_probability"] = defect_prob
        result["defect_threshold"] = threshold_percent

        inference_ms = round((time.perf_counter() - started_at) * 1000.0, 2)

        return jsonify({
            "success": True,
            "trace_id": g.request_id,
            "request_id": request_id,
            "filename": filename,
            "inference_ms": inference_ms,
            "prediction": result,
        })

    except ValueError as exc:
        # Covers corrupt/unreadable image from _validate_image_file
        logger.warning("Image validation failed request_id=%s filename=%s: %s",
                       request_id, filename, exc)
        return _json_error(
            str(exc),
            400,
            code="invalid_image",
            hint="Ensure the file is a valid, uncorrupted image. "
                 "Try opening it in an image viewer first. If re-exporting doesn't help, "
                 "try converting it to JPEG or PNG with an image editor.",
            details={"filename": filename, "request_id": request_id},
        )

    except FileNotFoundError as exc:
        # Model weights file missing — typically means the model was never trained
        logger.error("Model file not found request_id=%s: %s", request_id, exc)
        return _json_error(
            "The trained model file could not be found on the server.",
            500,
            code="model_file_not_found",
            hint="The model has not been trained yet, or the model file was moved/deleted. "
                 "Run the training pipeline to generate 'textile_defect_model.keras' "
                 "and place it in the 'saved_model/' directory.",
            details={"model_path": str(exc), "request_id": request_id},
        )

    except MemoryError:
        logger.error("Out of memory during prediction request_id=%s", request_id)
        return _json_error(
            "The server ran out of memory while processing this image.",
            503,
            code="out_of_memory",
            hint="Try uploading a smaller or lower-resolution image. "
                 "Large images require significantly more memory during inference.",
            details={"request_id": request_id},
        )

    except Exception as exc:
        logger.exception("Unexpected prediction failure request_id=%s filename=%s",
                         request_id, filename)
        return _json_error(
            "An unexpected error occurred while analysing the image.",
            500,
            code="prediction_failed",
            hint="This is an internal server error. Try again with a different image. "
                 "If the issue persists, share the request_id with the administrator.",
            details={"request_id": request_id, "error_type": type(exc).__name__},
        )

    finally:
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
            if ref_filepath and os.path.exists(ref_filepath):
                os.remove(ref_filepath)
        except OSError as exc:
            logger.warning("Could not delete temp file: %s", exc)


@app.route("/api/model-info", methods=["GET"])
def model_info():
    """Return information about the analysis pipeline."""
    info = {
        "model_name": "OpenCV + SSIM Hybrid",
        "task": "Structural Similarity + CV Feature Fusion",
        "classes": ["defective", "non_defective"],
        "input_size": "256x256",
        "cv_features": ["SSIM", "Laplacian variance", "Edge density"],
        "diagnostics": get_system_diagnostics(),
    }
    return jsonify(info)


@app.route("/api/performance", methods=["GET"])
def performance_metrics():
    """Return system and API performance metrics."""
    with _METRICS_LOCK:
        total_reqs = _METRICS["total_requests"]
        total_errs = _METRICS["total_errors"]
        lat_hist = list(_METRICS["latency_history"])
        
    avg_latency = sum(lat_hist) / len(lat_hist) if lat_hist else 0.0
    
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    uptime = time.time() - _SERVER_START_TIME

    return jsonify({
        "status": "ok",
        "system": {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_used_mb": round(memory.used / (1024 * 1024), 2),
            "memory_total_mb": round(memory.total / (1024 * 1024), 2),
            "uptime_seconds": round(uptime, 2)
        },
        "api": {
            "total_requests": total_reqs,
            "total_errors": total_errs,
            "avg_latency_ms": round(avg_latency, 2),
            "error_rate_percent": round((total_errs / max(total_reqs, 1)) * 100, 2)
        }
    })

# ── Status Dashboard HTML ──────────────────────────────────────────────────────

def _build_status_html() -> str:
    """Build a rich HTML status dashboard page."""
    import json as _json
    import platform, datetime

    diagnostics = get_system_diagnostics()
    model_exists = diagnostics.get("model_exists", False)
    model_loaded = diagnostics.get("model_loaded", False)
    cv_available = diagnostics.get("cv_available", False)
    pipeline = diagnostics.get("pipeline", "unknown")
    threshold = diagnostics.get("defect_threshold", 0.6)

    server_status = "ONLINE"
    model_status_label = "LOADED" if model_loaded else ("FOUND" if model_exists else "NOT FOUND")
    model_color = "#22c55e" if model_loaded else ("#f59e0b" if model_exists else "#ef4444")
    model_dot = "#22c55e" if model_loaded else ("#f59e0b" if model_exists else "#ef4444")

    # Removed ML training history variables since the model is fully removed

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    py_ver = platform.python_version()
    os_info = f"{platform.system()} {platform.release()}"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Textile Defect API — Server Status</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

    :root {{
      --bg:        #0a0e1a;
      --bg2:       #0f1525;
      --card:      #141b2d;
      --card2:     #1a2340;
      --border:    #1e2d4a;
      --border2:   #2a3d5e;
      --text:      #e2e8f0;
      --muted:     #64748b;
      --accent:    #3b82f6;
      --accent2:   #6366f1;
      --green:     #22c55e;
      --yellow:    #f59e0b;
      --red:       #ef4444;
      --cyan:      #06b6d4;
      --purple:    #a855f7;
    }}

    body {{
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
    }}

    /* animated gradient background */
    body::before {{
      content: '';
      position: fixed; inset: 0; z-index: -1;
      background:
        radial-gradient(ellipse 80% 60% at 10% 5%,  rgba(59,130,246,.12) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 90% 90%,  rgba(99,102,241,.10) 0%, transparent 60%),
        radial-gradient(ellipse 50% 40% at 50% 50%,  rgba(6,182,212,.05) 0%, transparent 70%);
    }}

    /* ── HEADER ── */
    header {{
      padding: 2rem 2.5rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(20,27,45,.9) 0%, transparent 100%);
      backdrop-filter: blur(12px);
      display: flex; align-items: center; gap: 1.5rem;
      flex-wrap: wrap;
    }}
    .logo-icon {{
      width: 52px; height: 52px; border-radius: 14px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      display: grid; place-items: center; font-size: 1.6rem; flex-shrink: 0;
      box-shadow: 0 0 24px rgba(59,130,246,.35);
    }}
    .header-text h1 {{ font-size: 1.55rem; font-weight: 800; letter-spacing: -.5px; }}
    .header-text p  {{ font-size: .85rem; color: var(--muted); margin-top: .15rem; }}
    .header-right {{ margin-left: auto; text-align: right; }}
    .header-right .ts {{ font-family: 'JetBrains Mono', monospace; font-size: .78rem; color: var(--muted); }}
    .live-badge {{
      display: inline-flex; align-items: center; gap: .45rem;
      background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.25);
      color: var(--green); border-radius: 999px; padding: .3rem .85rem;
      font-size: .75rem; font-weight: 600; letter-spacing: .5px;
      margin-bottom: .35rem;
    }}
    .live-badge .dot {{
      width: 7px; height: 7px; border-radius: 50%; background: var(--green);
      animation: pulse 1.6s ease-in-out infinite;
    }}
    @keyframes pulse {{
      0%,100% {{ opacity: 1; transform: scale(1); }}
      50%      {{ opacity: .5; transform: scale(.75); }}
    }}

    /* ── MAIN GRID ── */
    main {{ padding: 2rem 2.5rem; max-width: 1300px; margin: 0 auto; }}

    /* ── STATUS ROW ── */
    .status-row {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem; margin-bottom: 1.75rem;
    }}
    .status-card {{
      background: var(--card); border: 1px solid var(--border);
      border-radius: 16px; padding: 1.25rem 1.5rem;
      display: flex; align-items: center; gap: 1rem;
      transition: border-color .2s, transform .2s;
    }}
    .status-card:hover {{ border-color: var(--border2); transform: translateY(-2px); }}
    .status-icon {{
      width: 44px; height: 44px; border-radius: 12px;
      display: grid; place-items: center; font-size: 1.3rem; flex-shrink: 0;
    }}
    .status-card .label {{ font-size: .75rem; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: .6px; }}
    .status-card .value {{ font-size: 1.05rem; font-weight: 700; margin-top: .15rem; }}
    .green-icon  {{ background: rgba(34,197,94,.12);  color: var(--green);  }}
    .blue-icon   {{ background: rgba(59,130,246,.12); color: var(--accent); }}
    .cyan-icon   {{ background: rgba(6,182,212,.12);  color: var(--cyan);   }}
    .purple-icon {{ background: rgba(168,85,247,.12); color: var(--purple); }}
    .model-icon  {{ background: rgba(0,0,0,.3); color: {model_color}; }}

    /* ── TWO-COL ── */
    .two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }}
    @media (max-width: 860px) {{ .two-col {{ grid-template-columns: 1fr; }} }}

    /* ── SECTION CARD ── */
    .section-card {{
      background: var(--card); border: 1px solid var(--border);
      border-radius: 18px; padding: 1.5rem;
      transition: border-color .2s;
    }}
    .section-card:hover {{ border-color: var(--border2); }}
    .section-card h2 {{
      font-size: .95rem; font-weight: 700; letter-spacing: .3px;
      color: var(--text); margin-bottom: 1rem;
      display: flex; align-items: center; gap: .55rem;
    }}
    .section-card h2 .chip {{
      font-size: .65rem; background: rgba(59,130,246,.15); color: var(--accent);
      border: 1px solid rgba(59,130,246,.25); border-radius: 6px;
      padding: .1rem .45rem; font-weight: 600; letter-spacing: .5px;
    }}

    /* ── KV TABLE ── */
    .kv-table {{ width: 100%; border-collapse: collapse; }}
    .kv-table tr {{ border-bottom: 1px solid var(--border); }}
    .kv-table tr:last-child {{ border-bottom: none; }}
    .kv-table td {{ padding: .65rem 0; font-size: .845rem; }}
    .kv-table td:first-child {{ color: var(--muted); width: 48%; }}
    .kv-table td:last-child  {{ font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: .8rem; word-break: break-all; }}

    /* ── STATUS PILL ── */
    .pill {{
      display: inline-flex; align-items: center; gap: .35rem;
      padding: .2rem .7rem; border-radius: 999px; font-size: .73rem; font-weight: 700;
    }}
    .pill.green  {{ background: rgba(34,197,94,.12);  color: var(--green);  border: 1px solid rgba(34,197,94,.2);  }}
    .pill.yellow {{ background: rgba(245,158,11,.12); color: var(--yellow); border: 1px solid rgba(245,158,11,.2); }}
    .pill.red    {{ background: rgba(239,68,68,.12);  color: var(--red);    border: 1px solid rgba(239,68,68,.2);  }}
    .pill .pdot  {{ width: 6px; height: 6px; border-radius: 50%; background: currentColor; }}

    /* ── METRICS GRID ── */
    .metrics-grid {{
      display: grid; grid-template-columns: repeat(3, 1fr); gap: .9rem;
    }}
    .metric-box {{
      background: var(--card2); border: 1px solid var(--border);
      border-radius: 12px; padding: 1rem; text-align: center;
    }}
    .metric-box .mv {{ font-size: 1.35rem; font-weight: 800; color: var(--accent); }}
    .metric-box .mk {{ font-size: .72rem; color: var(--muted); margin-top: .2rem; font-weight: 500; text-transform: uppercase; letter-spacing: .5px; }}

    /* ── PROGRESS BAR ── */
    .prog-wrap {{ margin: .4rem 0; }}
    .prog-label {{ font-size: .75rem; color: var(--muted); display: flex; justify-content: space-between; margin-bottom: .3rem; }}
    .prog-bar {{ height: 6px; border-radius: 999px; background: var(--border2); overflow: hidden; }}
    .prog-fill {{ height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), var(--accent2)); transition: width .8s ease; }}

    /* ── ENDPOINTS TABLE ── */
    .ep-table {{ width: 100%; border-collapse: collapse; font-size: .83rem; }}
    .ep-table th {{ text-align: left; font-size: .7rem; text-transform: uppercase; letter-spacing: .7px; color: var(--muted); padding: .5rem 0; border-bottom: 1px solid var(--border); font-weight: 600; }}
    .ep-table td {{ padding: .6rem 0; border-bottom: 1px solid var(--border); vertical-align: middle; }}
    .ep-table tr:last-child td {{ border-bottom: none; }}
    .method {{ display: inline-block; padding: .15rem .55rem; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: .72rem; font-weight: 700; }}
    .get {{ background: rgba(34,197,94,.12); color: var(--green); }}
    .post{{ background: rgba(245,158,11,.12); color: var(--yellow); }}
    .ep-path {{ font-family: 'JetBrains Mono', monospace; color: var(--text); }}
    .ep-desc {{ color: var(--muted); padding-left: 1rem; }}

    /* ── MODEL PATH ── */
    .path-box {{
      background: var(--card2); border: 1px solid var(--border);
      border-radius: 10px; padding: .75rem 1rem;
      font-family: 'JetBrains Mono', monospace; font-size: .76rem;
      color: var(--cyan); word-break: break-all; margin-top: .75rem;
    }}

    /* ── FOOTER ── */
    footer {{
      text-align: center; padding: 2rem; color: var(--muted);
      font-size: .78rem; border-top: 1px solid var(--border); margin-top: 2rem;
    }}
    footer a {{ color: var(--accent); text-decoration: none; }}
    footer a:hover {{ text-decoration: underline; }}

    /* ── FULL-WIDTH ── */
    .full-width {{ margin-bottom: 1.25rem; }}
  </style>
</head>
<body>

<header>
  <div class="logo-icon">🧵</div>
  <div class="header-text">
    <h1>Textile Defect Detection API</h1>
    <p>Backend Server &amp; Model Status Dashboard</p>
  </div>
  <div class="header-right">
    <div class="live-badge"><span class="dot"></span> SERVER ONLINE</div>
    <div class="ts">Last refreshed: {now}</div>
  </div>
</header>

<main>

  <!-- Status Row -->
  <div class="status-row">
    <div class="status-card">
      <div class="status-icon green-icon">🟢</div>
      <div>
        <div class="label">Server</div>
        <div class="value" style="color:var(--green)">{server_status}</div>
      </div>
    </div>
    <div class="status-card">
      <div class="status-icon model-icon">🤖</div>
      <div>
        <div class="label">Model</div>
        <div class="value" style="color:{model_color}">{model_status_label}</div>
      </div>
    </div>
    <div class="status-card">
      <div class="status-icon {"green-icon" if cv_available else "red-icon"}">👁️</div>
      <div>
        <div class="label">OpenCV</div>
        <div class="value" style="color:{'var(--green)' if cv_available else 'var(--red)'}">{"AVAILABLE" if cv_available else "UNAVAILABLE"}</div>
      </div>
    </div>
    <div class="status-card">
      <div class="status-icon blue-icon">⚡</div>
      <div>
        <div class="label">Pipeline</div>
        <div class="value" style="color:var(--accent)">{pipeline.replace("_"," ").upper()}</div>
      </div>
    </div>
    <div class="status-card">
      <div class="status-icon cyan-icon">🎯</div>
      <div>
        <div class="label">Defect Threshold</div>
        <div class="value" style="color:var(--cyan)">{int(threshold*100)}%</div>
      </div>
    </div>
  </div>

  <!-- Two columns: System Info + Model Health -->
  <div class="two-col">

    <!-- System Info -->
    <div class="section-card">
      <h2>🖥️ System Information <span class="chip">RUNTIME</span></h2>
      <table class="kv-table">
        <tr><td>Server Status</td><td><span class="pill green"><span class="pdot"></span>Running</span></td></tr>
        <tr><td>Python Version</td><td>{py_ver}</td></tr>
        <tr><td>Operating System</td><td>{os_info}</td></tr>
        <tr><td>Host</td><td>127.0.0.1:5000</td></tr>
        <tr><td>Max Upload Size</td><td>{app.config.get("MAX_CONTENT_LENGTH", 0) // (1024*1024)} MB</td></tr>
        <tr><td>Rate Limit</td><td>{RATE_LIMIT_MAX_REQUESTS} req / {RATE_LIMIT_WINDOW_SEC}s</td></tr>
        <tr><td>CORS Origins</td><td>*</td></tr>
      </table>
    </div>

    <!-- Model Health -->
    <div class="section-card">
      <h2>🤖 Model Health <span class="chip">ML</span></h2>
      <table class="kv-table">
        <tr>
          <td>Model File</td>
          <td>{'<span class="pill green"><span class="pdot"></span>EXISTS</span>' if model_exists else '<span class="pill red"><span class="pdot"></span>MISSING</span>'}</td>
        </tr>
        <tr>
          <td>Model Loaded</td>
          <td>{'<span class="pill green"><span class="pdot"></span>YES</span>' if model_loaded else '<span class="pill yellow"><span class="pdot"></span>NOT YET (lazy load)</span>'}</td>
        </tr>
        <tr>
          <td>OpenCV (CV)</td>
          <td>{'<span class="pill green"><span class="pdot"></span>AVAILABLE</span>' if cv_available else '<span class="pill red"><span class="pdot"></span>UNAVAILABLE</span>'}</td>
        </tr>
        <tr><td>Architecture</td><td>OpenCV + SSIM Hybrid</td></tr>
        <tr><td>Task</td><td>Binary Classification</td></tr>
        <tr><td>Input Shape</td><td>224 × 224 × 3</td></tr>
        <tr><td>Classes</td><td>defective · non_defective</td></tr>
        <tr><td>Defect Threshold</td><td>{int(threshold*100)}%</td></tr>
      </table>
      <div class="path-box">{diagnostics.get("model_path","—")}</div>
    </div>

  </div>

  <!-- (Removed Training Metrics as ML model is no longer used) -->

  <!-- API Endpoints -->
  <div class="section-card full-width">
    <h2>🔌 API Endpoints <span class="chip">REST</span></h2>
    <table class="ep-table">
      <thead>
        <tr>
          <th>Method</th>
          <th>Endpoint</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="method get">GET</span></td>
          <td class="ep-path">/api/health</td>
          <td class="ep-desc">Server &amp; model health check</td>
        </tr>
        <tr>
          <td><span class="method get">GET</span></td>
          <td class="ep-path">/api/model-info</td>
          <td class="ep-desc">Model architecture &amp; training metadata</td>
        </tr>
        <tr>
          <td><span class="method post">POST</span></td>
          <td class="ep-path">/api/predict</td>
          <td class="ep-desc">Upload fabric image → defect prediction</td>
        </tr>
        <tr>
          <td><span class="method get">GET</span></td>
          <td class="ep-path">/status</td>
          <td class="ep-desc">This status dashboard</td>
        </tr>
      </tbody>
    </table>
  </div>

</main>

<footer>
  Textile Pattern Defect Detection System &nbsp;·&nbsp;
  <a href="/api/health">/api/health</a> &nbsp;·&nbsp;
  &nbsp;·&nbsp; Built with Flask + OpenCV
</footer>

<!-- Auto-refresh every 30 seconds -->
<script>
  setTimeout(() => location.reload(), 30000);
</script>

</body>
</html>"""
    return html


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route('/status')
def status_dashboard():
    """Rich HTML status/health dashboard."""
    from flask import Response
    return Response(_build_status_html(), mimetype='text/html')


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve the frontend build if present, otherwise show the status dashboard."""
    index_path = os.path.join(FRONTEND_DIST, 'index.html')
    if not os.path.exists(FRONTEND_DIST) or not os.path.exists(index_path):
        # Frontend not built — show the status dashboard instead of a bare JSON error
        from flask import Response
        return Response(_build_status_html(), mimetype='text/html')

    # If the requested file exists in dist (assets), serve it directly
    requested = os.path.join(FRONTEND_DIST, path)
    if path and os.path.exists(requested):
        return send_from_directory(FRONTEND_DIST, path)

    # Otherwise serve index.html (SPA)
    return send_from_directory(FRONTEND_DIST, 'index.html')


if __name__ == "__main__":
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    port = int(os.environ.get("PORT", "5000"))
    logger.info("Starting backend on port %s (debug=%s)", port, debug)
    app.run(debug=debug, port=port)
