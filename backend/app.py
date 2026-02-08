"""
Flask API server for the Textile Defect Detection System.
Provides endpoints for image upload and defect prediction.
"""

import os
from flask import Flask, request, jsonify
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
    """Return information about the trained model."""
    history_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "saved_model",
        "training_history.json",
    )

    info = {
        "model_name": "MobileNetV2 (Transfer Learning)",
        "task": "Binary Classification",
        "classes": ["defective", "non_defective"],
        "input_size": "224x224x3",
    }

    if os.path.exists(history_path):
        import json
        with open(history_path, "r") as f:
            history = json.load(f)
        info["training_epochs"] = len(history.get("accuracy", []))
        info["final_train_accuracy"] = history.get("accuracy", [None])[-1]
        info["final_val_accuracy"] = history.get("val_accuracy", [None])[-1]

    return jsonify(info)


if __name__ == "__main__":
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.run(debug=True, port=5000)
