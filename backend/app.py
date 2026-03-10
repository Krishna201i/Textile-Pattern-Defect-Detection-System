"""
Flask API server for the Textile Defect Detection System.
Provides endpoints for image upload and defect prediction.
"""

import os
import time
import uuid
import logging
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from model.predict import predict_image, get_system_diagnostics

app = Flask(__name__)
CORS(app)
logger = logging.getLogger(__name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tiff"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB max

# Path to frontend build (Vite `dist`) — sibling folder to backend
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist"))
RECORDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_model", "scan_records.json")


def _load_records():
    if not os.path.exists(RECORDS_PATH):
        return []
    try:
        with open(RECORDS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_records(records):
    os.makedirs(os.path.dirname(RECORDS_PATH), exist_ok=True)
    with open(RECORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)


def _to_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return float(default)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.errorhandler(413)
def payload_too_large(_error):
    return jsonify({"error": "Uploaded file is too large (max 16 MB)."}), 413


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
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "error": f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        }), 400

    request_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1]
    temp_name = f"{request_id}{ext}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], temp_name)
    started_at = time.perf_counter()
    file.save(filepath)

    try:
        result = predict_image(filepath)
        inference_ms = round((time.perf_counter() - started_at) * 1000.0, 2)

        records = _load_records()
        records.append({
            "id": request_id,
            "owner": "local",
            "filename": filename,
            "label": result.get("label", "unknown"),
            "confidence": _to_float(result.get("confidence", 0.0)),
            "defect_probability": _to_float(result.get("defect_probability", 0.0)),
            "pipeline": result.get("pipeline", "unknown"),
            "time": datetime.now().isoformat(),
            "inference_ms": inference_ms,
            "admin_note": "",
        })
        _save_records(records)

        return jsonify({
            "success": True,
            "request_id": request_id,
            "filename": filename,
            "inference_ms": inference_ms,
            "prediction": result,
        })
    except FileNotFoundError as e:
        logger.exception("Prediction failed: model file issue")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.exception("Prediction failed unexpectedly")
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500
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
    records = _load_records()
    records = sorted(records, key=lambda item: item.get("time", ""), reverse=True)
    return jsonify({"success": True, "records": records})


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
    records = _load_records()

    for record in records:
        if record.get("id") == record_id:
            record["label"] = payload.get("label", record.get("label", "unknown"))
            record["confidence"] = _to_float(payload.get("confidence", record.get("confidence", 0.0)))
            record["defect_probability"] = _to_float(payload.get("defect_probability", record.get("defect_probability", 0.0)))
            record["admin_note"] = str(payload.get("admin_note", record.get("admin_note", "")))
            record["updated_at"] = datetime.now().isoformat()
            _save_records(records)
            return jsonify({"success": True, "record": record})

    return jsonify({"error": "Record not found"}), 404


@app.route("/api/admin/records/<record_id>", methods=["DELETE"])
def admin_delete_record(record_id):
    """Delete a specific local admin record."""
    records = _load_records()
    updated = [record for record in records if record.get("id") != record_id]

    if len(updated) == len(records):
        return jsonify({"error": "Record not found"}), 404

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
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(debug=debug, port=5000)
