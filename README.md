# Textile Pattern Defect Detection System

An AI-powered system for automatically detecting defects in textile fabric patterns using image processing and deep learning. Upload a fabric image and the system classifies it as **defective** or **non-defective** using a MobileNetV2 CNN model.

## Project Structure

```
Textile-Pattern-Defect-Detection-System/
├── backend/
│   ├── model/
│   │   ├── preprocess.py       # Image preprocessing & data augmentation
│   │   ├── train.py            # Model training script
│   │   └── predict.py          # Prediction module
│   ├── saved_model/            # Trained model files (generated after training)
│   ├── uploads/                # Temporary upload directory
│   ├── app.py                  # Flask API server
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/         # React UI components
│   │   ├── styles/             # CSS stylesheets
│   │   ├── App.jsx             # Main application component
│   │   └── main.jsx            # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── dataset/
│   ├── train/
│   │   ├── defective/          # Defective fabric images for training
│   │   └── non_defective/      # Non-defective fabric images for training
│   └── test/
│       ├── defective/          # Defective fabric images for testing
│       └── non_defective/      # Non-defective fabric images for testing
└── notebooks/                  # Jupyter notebooks for exploration
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| ML Model | TensorFlow / Keras — MobileNetV2 (Transfer Learning) |
| Backend API | Flask |
| Frontend | React (Vite) |
| Image Processing | OpenCV, Pillow |

## Setup Instructions

### Prerequisites

- Python 3.10+
- Node.js 18+
- pip and npm

### 1. Prepare the Dataset

Place fabric images in the dataset directory:

- `dataset/train/defective/` — defective fabric images for training
- `dataset/train/non_defective/` — non-defective fabric images for training
- `dataset/test/defective/` — defective fabric images for testing
- `dataset/test/non_defective/` — non-defective fabric images for testing

Aim for at least 50-100 images per class for reasonable results.

### 2. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Train the Model

```bash
cd backend/model
python train.py
```

This will:
- Load and augment the training images
- Train a MobileNetV2 model with transfer learning
- Save the trained model to `backend/saved_model/`
- Generate training accuracy/loss plots

### 4. Start the Backend Server

```bash
cd backend
python app.py
```

The Flask API will start on `http://localhost:5000`.

### 5. Install & Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The React app will start on `http://localhost:3000` and automatically proxy API requests to the backend.

### 6. Use the Application

1. Open `http://localhost:3000` in your browser
2. Upload a fabric image via drag-and-drop or file browser
3. View the prediction result: defective or non-defective with confidence score

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/predict` | Upload image and get prediction |
| GET | `/api/model-info` | Get model training details |

## Model Details

- **Architecture**: MobileNetV2 (pre-trained on ImageNet) with a custom classification head
- **Approach**: Transfer learning — frozen base layers + trainable Dense/Dropout head
- **Input**: 224x224 RGB images
- **Output**: Binary classification (defective / non-defective)
- **Training**: Data augmentation (rotation, flip, shift, zoom) + early stopping
