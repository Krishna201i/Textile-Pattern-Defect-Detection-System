"""
Flask API server for the Textile Defect Detection System.
Provides endpoints for image upload and defect prediction.
"""

import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from model.predict import predict_image

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tiff"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB max

# Path to frontend build (Vite `dist`) — sibling folder to backend
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist"))

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "Server is running"})


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

    # Save uploaded file
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    try:
        result = predict_image(filepath)
        return jsonify({
            "success": True,
            "prediction": result,
        })
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
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
    }

    if os.path.exists(history_path):
        import json
        with open(history_path, "r") as f:
            history = json.load(f)
        info["training_epochs"] = len(history.get("accuracy", []))
        info["final_train_accuracy"] = history.get("accuracy", [None])[-1]
        info["final_val_accuracy"] = history.get("val_accuracy", [None])[-1]

    return jsonify(info)

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
    # Ensure Flask will serve the frontend after building
    app.run(debug=True, port=5000)
