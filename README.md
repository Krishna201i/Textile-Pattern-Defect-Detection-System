# Textile Pattern Defect Detection System

AI-powered textile quality inspection system for binary defect classification (`defective` / `non_defective`) with a professional user portal and admin portal.

## What This Project Does

- Predicts defect probability from uploaded or camera-captured fabric images.
- Uses a **hybrid inference pipeline**: custom CNN + classical CV features (texture/edge-based).
- Supports user history analytics and admin record management.
- Uses Firebase (Firestore + Storage) so user and admin portals share the same scan records.

## Current Architecture

### ML Inference

- **Model**: EfficientNetB0 (ImageNet Pretrained) + Transfer Learning
- **Robustness**: Handles both simple fabrics and patterned/complex fabrics.
- **Preprocessing**: 224x224 RGB, EfficientNet specific normalization [-1, 1].
- **CV fusion**: Laplacian variance + edge density (OpenCV) for additional feature extraction.
- **Decision threshold**: defect classification threshold configured to 60% by default.

### Backend

- Flask API with:
	- health/model diagnostics
	- prediction endpoint
	- request tracing headers
	- upload validation and payload limits
	- basic rate limiting on prediction endpoint
	- inference-only (records are stored in Firebase)

### Frontend

- React + Vite
- Authenticated user portal (detect, analytics, history)
- Admin portal (search/filter/edit/delete/export)
- Image source modes:
	- Upload mode
	- Camera mode with brightness/blur quality checks

## Project Structure

```text
Textile-Pattern-Defect-Detection-System/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── tools/
│   │   ├── migrate_scan_records.py
│   │   ├── grant_admin.py
│   │   └── export_scans_csv.py
│   ├── model/
│   │   ├── preprocess.py
│   │   ├── predict.py
│   │   ├── train.py
│   │   └── train_v2.py
│   ├── saved_model/
│   │   ├── textile_defect_model.keras
│   │   ├── training_history.json
│   │   └── scan_records.json
│   └── uploads/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── firebaseService.js
│       ├── components/
│       └── pages/
├── dataset/
│   ├── train/
│   │   ├── defective/
│   │   └── non_defective/
│   └── test/
│       ├── defective/
│       └── non_defective/
├── tests/
│   ├── fixtures/
│   └── test_*.py
├── data/
│   └── scan_records_export_after_migration.csv
├── notebooks/
└── restart_servers.bat
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1) Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2) (Optional) Train / Retrain Model

```bash
cd backend/model
python train.py
```

### 3) Firebase Setup (Required)

- Enable Firestore and Storage in Firebase Console:
	- Firestore: https://console.firebase.google.com/project/_/firestore
	- Storage: https://console.firebase.google.com/project/_/storage
- In Authentication, enable Email/Password if you use email login:
	- https://console.firebase.google.com/project/_/authentication/providers
- Deploy the included rules:

```bash
firebase deploy --only firestore:rules,storage:rules
```

### 4) (Optional) Migrate Local Records to Firestore

```bash
set FIREBASE_SERVICE_ACCOUNT_JSON=C:\path\to\service-account.json
python backend\tools\migrate_scan_records.py
```

### 5) (Optional) Grant Admin Access (by UID)

```bash
set FIREBASE_SERVICE_ACCOUNT_JSON=C:\path\to\service-account.json
python backend\tools\grant_admin.py <FIREBASE_UID>
```

### 6) (Optional) Export All Scans to CSV

```bash
set FIREBASE_SERVICE_ACCOUNT_JSON=C:\path\to\service-account.json
python backend\tools\export_scans_csv.py
```

### 7) Start Backend

```bash
cd backend
python app.py
```

Backend runs on `http://127.0.0.1:5000`.

### 8) Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## API Reference

### Core

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health + runtime diagnostics |
| GET | `/api/model-info` | Model/pipeline metadata |
| POST | `/api/predict` | Predict defect from multipart image |

`/api/predict` form fields:

- `image` (required)
- `owner` (optional, user ID for sync)
- `source` (optional: `upload` or `camera`)

### Admin Records

Admin portal reads/writes scan records from Firestore collection `scan_records`.

## Environment Variables (Backend)

- `PORT` (default: `5000`)
- `FLASK_DEBUG` (default: `0`)
- `MAX_UPLOAD_MB` (default: `16`)
- `CORS_ORIGINS` (default: `*`)
- `LOG_LEVEL` (default: `INFO`)
- `PREDICT_RATE_WINDOW_SEC` (default: `60`)
- `PREDICT_RATE_MAX_REQUESTS` (default: `30`)
- `DEFECT_THRESHOLD` (model-layer threshold, default: `0.60`)
- `DEFECT_THRESHOLD_PERCENT` (API-layer threshold, default: `60`)

## Notes

- Current system performs **classification**, not localization.
- For defect localization (`where` defect exists), move to object detection (e.g., YOLO) with bounding-box annotations.
