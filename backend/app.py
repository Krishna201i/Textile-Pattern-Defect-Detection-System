"""
Flask API server for the Textile Defect Detection System.
Provides endpoints for image upload and defect prediction.
"""

import os
import time
import uuid
import logging
import json
import tempfile
import threading
from collections import defaultdict, deque
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError
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
RECORDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_model", "scan_records.json")
RECORD_LOCK = threading.Lock()

RATE_LIMIT_WINDOW_SEC = int(os.environ.get("PREDICT_RATE_WINDOW_SEC", "60"))
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get("PREDICT_RATE_MAX_REQUESTS", "30"))
_PREDICT_RATE_BUCKETS: dict[str, deque] = defaultdict(deque)
_RATE_LOCK = threading.Lock()

VALID_LABELS = {"defective", "non_defective"}
MAX_NOTE_LEN = int(os.environ.get("ADMIN_NOTE_MAX_LEN", "500"))


def _json_error(message: str, status_code: int, *, code: str | None = None):
    payload = {
        "success": False,
        "error": message,
        "request_id": getattr(g, "request_id", None),
    }
    if code:
        payload["code"] = code
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


def _load_records():
    with RECORD_LOCK:
        if not os.path.exists(RECORDS_PATH):
            return []
        try:
            with open(RECORDS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except Exception:
            logger.exception("Failed to load records file")
            return []


def _save_records(records):
    os.makedirs(os.path.dirname(RECORDS_PATH), exist_ok=True)
    with RECORD_LOCK:
        temp_fd, temp_path = tempfile.mkstemp(
            prefix="scan_records_",
            suffix=".json",
            dir=os.path.dirname(RECORDS_PATH),
        )
        try:
            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
            os.replace(temp_path, RECORDS_PATH)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


def _to_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return float(default)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _validate_image_file(filepath: str) -> None:
    try:
        with Image.open(filepath) as img:
            img.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValueError("Uploaded file is not a valid image")


def _clamp_percent(value, default=0.0):
    value = _to_float(value, default)
    return float(max(0.0, min(100.0, value)))


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
    return response


@app.errorhandler(413)
def payload_too_large(_error):
    return _json_error("Uploaded file is too large.", 413, code="payload_too_large")


@app.errorhandler(400)
def bad_request(_error):
    return _json_error("Bad request.", 400, code="bad_request")


@app.errorhandler(404)
def not_found(_error):
    return _json_error("Resource not found.", 404, code="not_found")


@app.errorhandler(405)
def method_not_allowed(_error):
    return _json_error("Method not allowed.", 405, code="method_not_allowed")


@app.errorhandler(500)
def internal_server_error(_error):
    logger.exception("Unhandled server error")
    return _json_error("Internal server error.", 500, code="internal_error")


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
    allowed, retry_after = _check_predict_rate_limit()
    if not allowed:
        return _json_error(
            f"Rate limit exceeded. Try again in {retry_after}s.",
            429,
            code="rate_limited",
        )

    if "image" not in request.files:
        return _json_error("No image file provided.", 400, code="missing_image")

    file = request.files["image"]
    if file.filename == "":
        return _json_error("No file selected.", 400, code="missing_filename")

    if not allowed_file(file.filename):
        return _json_error(
            f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
            400,
            code="invalid_extension",
        )

    request_id = str(uuid.uuid4())
    owner = str((request.form.get("owner") or "local")).strip()[:120] or "local"
    source = str((request.form.get("source") or "upload")).strip().lower()
    if source not in {"upload", "camera"}:
        source = "upload"
    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1]
    temp_name = f"{request_id}{ext}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], temp_name)
    started_at = time.perf_counter()
    file.save(filepath)

    try:
        _validate_image_file(filepath)
        result = predict_image(filepath)
        inference_ms = round((time.perf_counter() - started_at) * 1000.0, 2)

        records = _load_records()
        records.append({
            "id": request_id,
            "owner": owner,
            "filename": filename,
            "label": result.get("label", "unknown"),
            "confidence": _to_float(result.get("confidence", 0.0)),
            "defect_probability": _to_float(result.get("defect_probability", 0.0)),
            "cnn_defect_probability": _to_float(result.get("cnn_defect_probability", 0.0)),
            "cv_defect_probability": _to_float(result.get("cv_defect_probability", 0.0)),
            "pipeline": result.get("pipeline", "unknown"),
            "source": source,
            "time": datetime.now().isoformat(),
            "inference_ms": inference_ms,
            "admin_note": "",
            "request_id": g.request_id,
        })
        _save_records(records)

        return jsonify({
            "success": True,
            "trace_id": g.request_id,
            "request_id": request_id,
            "filename": filename,
            "inference_ms": inference_ms,
            "prediction": result,
        })
    except ValueError as e:
        return _json_error(str(e), 400, code="invalid_image")
    except FileNotFoundError as e:
        logger.exception("Prediction failed: model file issue")
        return _json_error(str(e), 500, code="model_file_error")
    except Exception as e:
        logger.exception("Prediction failed unexpectedly")
        return _json_error(f"Prediction failed: {str(e)}", 500, code="prediction_failed")
    finally:
        # Clean up uploaded file
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route("/api/model-info", methods=["GET"])
def model_info():
    """Return information about the trained model pipeline."""
    history_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "saved_model",
        "training_history.json",
    )

    info = {
        "model_name": "Custom CNN + Computer Vision Hybrid",
        "task": "Binary Classification + CV Feature Fusion",
        "classes": ["defective", "non_defective"],
        "input_size": "224x224x3",
        "cv_features": ["Laplacian texture", "Edge density"],
        "diagnostics": get_system_diagnostics(),
    }

    if os.path.exists(history_path):
        import json
        with open(history_path, "r") as f:
            history = json.load(f)
        info["training_epochs"] = len(history.get("accuracy", []))
        info["final_train_accuracy"] = history.get("accuracy", [None])[-1]
        info["final_val_accuracy"] = history.get("val_accuracy", [None])[-1]

    return jsonify(info)


@app.route("/api/admin/records", methods=["GET"])
def admin_records():
    """Return all locally persisted scan records for admin portal."""
    records = sorted(_load_records(), key=lambda item: item.get("time", ""), reverse=True)

    label_filter = (request.args.get("label") or "").strip().lower()
    owner_filter = (request.args.get("owner") or "").strip()
    query = (request.args.get("q") or "").strip().lower()
    limit = int(request.args.get("limit", "200"))
    offset = int(request.args.get("offset", "0"))
    limit = max(1, min(1000, limit))
    offset = max(0, offset)

    if label_filter in VALID_LABELS:
        records = [record for record in records if record.get("label") == label_filter]

    if owner_filter:
        records = [record for record in records if str(record.get("owner", "")) == owner_filter]

    if query:
        records = [
            record for record in records
            if query in str(record.get("id", "")).lower()
            or query in str(record.get("owner", "")).lower()
            or query in str(record.get("filename", "")).lower()
        ]

    total_filtered = len(records)
    page_records = records[offset: offset + limit]

    return jsonify({
        "success": True,
        "records": page_records,
        "meta": {
            "total_filtered": total_filtered,
            "limit": limit,
            "offset": offset,
        },
    })


@app.route("/api/admin/records", methods=["POST"])
def admin_create_record():
    """Create a new admin record directly (used by user sync fallback)."""
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return _json_error("Invalid JSON payload.", 400, code="invalid_payload")

    label = payload.get("label", "unknown")
    if label not in VALID_LABELS:
        return _json_error("Invalid label value.", 400, code="invalid_label")

    owner = str(payload.get("owner", "local")).strip()[:120] or "local"
    source = str(payload.get("source", "upload")).strip().lower()
    if source not in {"upload", "camera"}:
        source = "upload"

    record = {
        "id": str(uuid.uuid4()),
        "owner": owner,
        "filename": str(payload.get("filename", "image"))[:240],
        "label": label,
        "confidence": _clamp_percent(payload.get("confidence", 0.0)),
        "defect_probability": _clamp_percent(payload.get("defect_probability", 0.0)),
        "cnn_defect_probability": _clamp_percent(payload.get("cnn_defect_probability", 0.0)),
        "cv_defect_probability": _clamp_percent(payload.get("cv_defect_probability", 0.0)),
        "pipeline": str(payload.get("pipeline", "cnn_cv_hybrid"))[:60],
        "source": source,
        "time": datetime.now().isoformat(),
        "inference_ms": _to_float(payload.get("inference_ms", 0.0)),
        "admin_note": str(payload.get("admin_note", payload.get("notes", "")))[:MAX_NOTE_LEN],
        "request_id": g.request_id,
    }

    records = _load_records()
    records.append(record)
    _save_records(records)
    return jsonify({"success": True, "record": record}), 201


@app.route("/api/admin/summary", methods=["GET"])
def admin_summary():
    """Return server-side aggregated summary for admin analytics."""
    records = _load_records()
    total = len(records)
    defective = sum(1 for r in records if r.get("label") == "defective")
    passed = sum(1 for r in records if r.get("label") == "non_defective")
    avg_confidence = round(
        sum(_to_float(r.get("confidence", 0.0)) for r in records) / total,
        2,
    ) if total else 0.0

    owner_counts = {}
    for record in records:
        owner = record.get("owner", "unknown")
        owner_counts[owner] = owner_counts.get(owner, 0) + 1

    top_owner = None
    if owner_counts:
        owner, count = sorted(owner_counts.items(), key=lambda x: x[1], reverse=True)[0]
        top_owner = {"owner": owner, "count": count}

    return jsonify({
        "success": True,
        "summary": {
            "total": total,
            "defective": defective,
            "passed": passed,
            "avg_confidence": avg_confidence,
            "top_owner": top_owner,
        },
    })


@app.route("/api/admin/records/<record_id>", methods=["PUT"])
def admin_update_record(record_id):
    """Update editable fields for a specific record."""
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return _json_error("Invalid JSON payload.", 400, code="invalid_payload")

    records = _load_records()

    for record in records:
        if record.get("id") == record_id:
            label = payload.get("label", record.get("label", "unknown"))
            if label not in VALID_LABELS:
                return _json_error("Invalid label value.", 400, code="invalid_label")

            owner = payload.get("owner", record.get("owner", "local"))
            admin_note = payload.get("admin_note", payload.get("notes", record.get("admin_note", "")))

            record["label"] = label
            record["owner"] = str(owner)[:120]
            record["confidence"] = _clamp_percent(payload.get("confidence", record.get("confidence", 0.0)))
            record["defect_probability"] = _clamp_percent(payload.get("defect_probability", record.get("defect_probability", 0.0)))
            record["admin_note"] = str(admin_note)[:MAX_NOTE_LEN]
            record["updated_at"] = datetime.now().isoformat()
            _save_records(records)
            return jsonify({"success": True, "record": record})

    return _json_error("Record not found.", 404, code="record_not_found")


@app.route("/api/admin/records/<record_id>", methods=["DELETE"])
def admin_delete_record(record_id):
    """Delete a specific local admin record."""
    records = _load_records()
    updated = [record for record in records if record.get("id") != record_id]

    if len(updated) == len(records):
        return _json_error("Record not found.", 404, code="record_not_found")

    _save_records(updated)
    return jsonify({"success": True})

# Keep API routes defined above. After API routes, add a fallback to serve the SPA
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Serve the frontend build if present. If the frontend isn't built yet, return a helpful message.
    This route intentionally comes after /api/* so API routes continue to work.
    """
    # If frontend dist is missing, return a JSON 501 so it's obvious in the browser
    index_path = os.path.join(FRONTEND_DIST, 'index.html')
    if not os.path.exists(FRONTEND_DIST) or not os.path.exists(index_path):
        return jsonify({
            "error": "Frontend not built. Run `npm run build` in the frontend folder and restart the backend to serve the UI from port 5000.",
            "frontend_dist": FRONTEND_DIST,
        }), 501

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
