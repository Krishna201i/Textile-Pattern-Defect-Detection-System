# Textile Pattern Defect Detection System

AI-powered textile quality inspection system for binary defect classification (`defective` / `non_defective`) with a professional user portal and admin portal.

## What This Project Does

- Predicts defect probability from uploaded or camera-captured fabric images.
- Uses a **hybrid inference pipeline**: custom CNN + classical CV features (texture/edge-based).
- Supports user history analytics and admin record management.
- Keeps user and admin portals synced through shared backend records.

## Current Architecture

### ML Inference

- **Model**: TensorFlow/Keras custom CNN
- **Preprocessing**: 224x224 RGB normalization
- **CV fusion**: Laplacian variance + edge density (OpenCV)
- **Decision threshold**: defect classification threshold configured to 60% by default

### Backend

- Flask API with:
	- health/model diagnostics
	- prediction endpoint
	- admin record CRUD + summary
	- request tracing headers
	- upload validation and payload limits
	- basic rate limiting on prediction endpoint
	- atomic local JSON record persistence

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
│   ├── model/
│   │   ├── preprocess.py
│   │   ├── predict.py
│   │   └── train.py
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
└── notebooks/
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

### 3) Start Backend

```bash
cd backend
python app.py
```

Backend runs on `http://127.0.0.1:5000`.

### 4) Start Frontend

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

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/records` | List records (supports `owner`, `label`, `q`, `limit`, `offset`) |
| POST | `/api/admin/records` | Create record directly |
| PUT | `/api/admin/records/<record_id>` | Update record |
| DELETE | `/api/admin/records/<record_id>` | Delete record |
| GET | `/api/admin/summary` | Aggregated summary |

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
