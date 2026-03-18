# TextileGuard: Pattern & Defect Detection System

An enterprise-grade, AI-powered textile quality inspection system. It features a highly robust binary defect classification engine (`defective` / `non_defective`) coupled with a professional user dashboard and administrative portal.

## What This Project Does

- **High-Accuracy Defect Detection**: Utilizes a state-of-the-art transfer learning model (EfficientNetB0) capable of identifying anomalies on both plain and highly patterned/textured fabrics.
- **Hybrid Inference Pipeline**: Combines deep learning with classical Computer Vision features (OpenCV Laplacian variance, edge density) for enhanced reliability against blurry or low-quality images.
- **Professional Dashboards**:
  - **User Portal**: Detect defects via secure file upload or live camera feed, view personal scan history, and analyze individual metrics.
  - **Admin Portal**: Comprehensive record management, global analytics (charts/graphs), and data export capabilities.
- **Cloud-Native Data**: Powered by Firebase (Firestore + Storage) for secure, real-time synchronization across all portals.

## Current Architecture

### ML Inference

- **Model**: EfficientNetB0 (ImageNet Pretrained) + Transfer Learning
- **Robustness**: Handles both simple plain fabrics and complex patterned fabrics (like stripes or logos) without triggering false positives.
- **Preprocessing**: 224x224 RGB, EfficientNet specific normalization `[-1, 1]`.
- **CV fusion**: Laplacian variance + edge density (OpenCV) for blurry image rejection and additional feature extraction.
- **Decision threshold**: Defect classification threshold configured to `60%` by default.

### Backend

- Python Flask API serving:
	- Health/model diagnostics
	- Prediction endpoint
	- Request tracing headers
	- Upload validation and payload limits
	- Basic rate limiting on the prediction endpoint
	- Stateless inference (records are stored securely in Firebase)
- **Deployment-Ready**: Uses `gunicorn` as the production WSGI server.

### Frontend

- React 18 + Vite
- Authenticated user interface using Firebase Auth.
- Image source modes:
	- Drag-and-drop file upload.
	- Live WebRTC Camera mode with brightness/blur quality checks.

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
│   │   ├── train.py          # Legacy CNN model
│   │   └── train_v2.py       # Current EfficientNetB0 model
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
│   └── test/
├── tests/
│   ├── fixtures/
│   └── test_*.py
├── data/
│   └── scan_records_export_after_migration.csv
├── notebooks/
└── restart_servers.bat
```

## Setup & Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1) Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2) (Optional) Train / Retrain Model

If you want to train the EfficientNet model from scratch on your own dataset:
```bash
cd backend/model
python train_v2.py
```

### 3) Firebase Setup (Required)

- Enable Firestore and Storage in your Firebase Console.
- In Authentication, enable the **Email/Password** provider.
- Deploy the included security rules:

```bash
firebase deploy --only firestore:rules,storage:rules
```

### 4) Start Backend

```bash
cd backend
python app.py
```

Backend runs on `http://127.0.0.1:5000`.

### 5) Start Frontend

Create a `.env` file in the `frontend` directory to link to your backend (especially useful if deploying):
```env
VITE_API_URL=http://127.0.0.1:5000
```

Then install and start the frontend:
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## Production Deployment

This project is fully configured for zero-cost cloud deployment via [Render](https://render.com/). 

- **Backend**: Deploys as a Python Web Service. Use the Build Command `pip install -r requirements.txt` and the Start Command `gunicorn app:app --bind 0.0.0.0:$PORT`.
- **Frontend**: Deploys as a React Static Site. Use the Build Command `npm install && npm run build` and publish the `dist` directory. Configure rewrite rules (`/*` to `/index.html`) for React Router.
- **Environment Variables**: Ensure you set the `VITE_API_URL` environment variable on the frontend service to point to your live backend URL.

## API Reference

### Core

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health + runtime diagnostics |
| GET | `/api/model-info` | Model/pipeline metadata |
| POST | `/api/predict` | Predict defect from multipart image |

`/api/predict` form fields:
- `image` (required)
- `owner` (optional, Firebase UID for record ownership)
- `source` (optional: `upload` or `camera`)

## Environment Variables (Backend)

- `PORT` (default: `5000`)
- `FLASK_DEBUG` (default: `0`)
- `MAX_UPLOAD_MB` (default: `16`)
- `CORS_ORIGINS` (default: `*` - restrict this in production!)
- `LOG_LEVEL` (default: `INFO`)
- `DEFECT_THRESHOLD` (model-layer threshold, default: `0.60`)
- `DEFECT_THRESHOLD_PERCENT` (API-layer threshold, default: `60`)
