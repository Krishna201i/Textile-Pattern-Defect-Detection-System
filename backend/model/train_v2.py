"""
TextileGuard Model Training v2 — EfficientNetB0 Transfer Learning

Two-phase training strategy:
  Phase 1: Feature extraction (backbone frozen, train classifier head)
  Phase 2: Fine-tuning (unfreeze last N layers, low LR end-to-end training)

Usage:
    cd backend
    python model/train_v2.py
"""

import os
import sys
import json
import numpy as np

# Suppress TF info logs
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import (
    EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ---------- Paths ----------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(os.path.dirname(BASE_DIR), "dataset")
SAVED_MODEL_DIR = os.path.join(BASE_DIR, "saved_model")
MODEL_PATH = os.path.join(SAVED_MODEL_DIR, "textile_defect_model.keras")
HISTORY_PATH = os.path.join(SAVED_MODEL_DIR, "training_history.json")
PLOT_PATH = os.path.join(SAVED_MODEL_DIR, "training_plot.png")
CONFUSION_PATH = os.path.join(SAVED_MODEL_DIR, "confusion_matrix.png")
REPORT_PATH = os.path.join(SAVED_MODEL_DIR, "evaluation_report.json")

# ---------- Config ----------
IMG_SIZE = 224
BATCH_SIZE = 32
PHASE1_EPOCHS = 10
PHASE2_EPOCHS = 20
PHASE1_LR = 1e-3
PHASE2_LR = 1e-5
FINE_TUNE_AT = -20  # Unfreeze last 20 layers
LABEL_SMOOTHING = 0.1
DROPOUT_RATE = 0.5
L2_WEIGHT = 1e-4
VALIDATION_SPLIT = 0.2
SEED = 42


# ---------- Data Augmentation (GPU-accelerated) ----------
def build_augmentation_layers():
    """Build data augmentation as Keras preprocessing layers (runs on GPU)."""
    return keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.15),
        layers.RandomZoom((-0.1, 0.1)),
        layers.RandomContrast(0.15),
        layers.RandomBrightness(0.15),
    ], name="augmentation")


# ---------- Model ----------
def build_model(num_classes=1):
    """Build EfficientNetB0-based binary classifier with data augmentation."""
    # Input
    inputs = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))

    # Augmentation (only applied during training)
    augmented = build_augmentation_layers()(inputs, training=True)

    # EfficientNetB0 backbone (ImageNet pretrained)
    base_model = EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_tensor=augmented,
    )
    base_model.trainable = False  # Freeze for Phase 1

    # Classifier head
    x = layers.GlobalAveragePooling2D(name="avg_pool")(base_model.output)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(
        256,
        activation="relu",
        kernel_regularizer=keras.regularizers.l2(L2_WEIGHT),
        name="dense_head",
    )(x)
    x = layers.Dropout(DROPOUT_RATE)(x)
    x = layers.Dense(
        64,
        activation="relu",
        kernel_regularizer=keras.regularizers.l2(L2_WEIGHT),
        name="dense_head_2",
    )(x)
    x = layers.Dropout(DROPOUT_RATE * 0.5)(x)
    outputs = layers.Dense(1, activation="sigmoid", name="prediction")(x)

    model = Model(inputs, outputs, name="textile_defect_efficientnet")
    return model, base_model


# ---------- Data Loading ----------
def load_datasets():
    """Load training, validation, and test datasets."""
    train_dir = os.path.join(DATASET_DIR, "train")
    test_dir = os.path.join(DATASET_DIR, "test")

    if not os.path.exists(train_dir):
        print(f"ERROR: Dataset not found at {train_dir}")
        sys.exit(1)

    # Training + Validation (from train folder with split)
    train_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        validation_split=VALIDATION_SPLIT,
        subset="training",
        seed=SEED,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode="binary",
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        validation_split=VALIDATION_SPLIT,
        subset="validation",
        seed=SEED,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode="binary",
    )

    # Test set
    test_ds = tf.keras.utils.image_dataset_from_directory(
        test_dir,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode="binary",
        shuffle=False,
    )

    # Performance: prefetch and cache
    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.prefetch(AUTOTUNE)
    val_ds = val_ds.cache().prefetch(AUTOTUNE)
    test_ds = test_ds.cache().prefetch(AUTOTUNE)

    return train_ds, val_ds, test_ds


# ---------- Training ----------
def train():
    print("=" * 60)
    print("  TextileGuard Model Training v2 — EfficientNetB0")
    print("=" * 60)

    # Load data
    print("\n📦 Loading datasets...")
    train_ds, val_ds, test_ds = load_datasets()

    # Build model
    print("\n🏗️  Building EfficientNetB0 model...")
    model, base_model = build_model()
    model.summary(print_fn=lambda x: print(f"  {x}"))

    os.makedirs(SAVED_MODEL_DIR, exist_ok=True)

    # ===== PHASE 1: Feature Extraction =====
    print(f"\n{'='*60}")
    print(f"  Phase 1: Feature Extraction (backbone frozen)")
    print(f"  LR={PHASE1_LR}, Epochs={PHASE1_EPOCHS}")
    print(f"{'='*60}")

    model.compile(
        optimizer=Adam(learning_rate=PHASE1_LR),
        loss=keras.losses.BinaryCrossentropy(label_smoothing=LABEL_SMOOTHING),
        metrics=[
            "accuracy",
            keras.metrics.Precision(name="precision"),
            keras.metrics.Recall(name="recall"),
            keras.metrics.AUC(name="auc"),
        ],
    )

    phase1_callbacks = [
        EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
            verbose=1,
        ),
        ModelCheckpoint(
            MODEL_PATH,
            monitor="val_auc",
            save_best_only=True,
            verbose=1,
            mode="max",
        ),
    ]

    history1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=PHASE1_EPOCHS,
        callbacks=phase1_callbacks,
    )

    # ===== PHASE 2: Fine-Tuning =====
    print(f"\n{'='*60}")
    print(f"  Phase 2: Fine-Tuning (last {abs(FINE_TUNE_AT)} layers unfrozen)")
    print(f"  LR={PHASE2_LR}, Epochs={PHASE2_EPOCHS}")
    print(f"{'='*60}")

    # Unfreeze the last N layers of the backbone
    base_model.trainable = True
    for layer in base_model.layers[:FINE_TUNE_AT]:
        layer.trainable = False

    # Re-compile with very low LR
    model.compile(
        optimizer=Adam(learning_rate=PHASE2_LR),
        loss=keras.losses.BinaryCrossentropy(label_smoothing=LABEL_SMOOTHING),
        metrics=[
            "accuracy",
            keras.metrics.Precision(name="precision"),
            keras.metrics.Recall(name="recall"),
            keras.metrics.AUC(name="auc"),
        ],
    )

    phase2_callbacks = [
        EarlyStopping(
            monitor="val_loss",
            patience=7,
            restore_best_weights=True,
            verbose=1,
        ),
        ModelCheckpoint(
            MODEL_PATH,
            monitor="val_auc",
            save_best_only=True,
            verbose=1,
            mode="max",
        ),
        ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.3,
            patience=3,
            min_lr=1e-7,
            verbose=1,
        ),
    ]

    history2 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=PHASE2_EPOCHS,
        callbacks=phase2_callbacks,
    )

    # ===== Evaluation =====
    print(f"\n{'='*60}")
    print("  Evaluating on test set...")
    print(f"{'='*60}")

    # Load best model
    best_model = keras.models.load_model(MODEL_PATH)
    test_results = best_model.evaluate(test_ds, return_dict=True)
    print(f"\n  Test Results:")
    for k, v in test_results.items():
        print(f"    {k}: {v:.4f}")

    # Confusion matrix & classification report
    y_true = []
    y_pred_proba = []
    for images, labels in test_ds:
        preds = best_model.predict(images, verbose=0)
        y_true.extend(labels.numpy().flatten())
        y_pred_proba.extend(preds.flatten())

    y_true = np.array(y_true)
    y_pred_proba = np.array(y_pred_proba)
    y_pred = (y_pred_proba > 0.5).astype(int)

    # Confusion matrix
    tp = int(np.sum((y_pred == 1) & (y_true == 1)))
    tn = int(np.sum((y_pred == 0) & (y_true == 0)))
    fp = int(np.sum((y_pred == 1) & (y_true == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true == 1)))
    cm = np.array([[tn, fp], [fn, tp]])

    accuracy = float((tp + tn) / max(1, tp + tn + fp + fn))
    precision = float(tp / max(1, tp + fp))
    recall = float(tp / max(1, tp + fn))
    f1 = float(2 * precision * recall / max(1e-8, precision + recall))

    report = {
        "test_accuracy": round(accuracy, 4),
        "test_precision": round(precision, 4),
        "test_recall": round(recall, 4),
        "test_f1": round(f1, 4),
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "test_results": {k: round(float(v), 4) for k, v in test_results.items()},
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n  Evaluation report saved to {REPORT_PATH}")

    # Plot confusion matrix
    fig, ax = plt.subplots(1, 1, figsize=(6, 5))
    im = ax.imshow(cm, interpolation="nearest", cmap="Blues")
    ax.set_title("Confusion Matrix", fontsize=14, fontweight="bold")
    ax.set_ylabel("True Label")
    ax.set_xlabel("Predicted Label")
    ax.set_xticks([0, 1]); ax.set_xticklabels(["Non-Defective", "Defective"])
    ax.set_yticks([0, 1]); ax.set_yticklabels(["Non-Defective", "Defective"])
    for i in range(2):
        for j in range(2):
            text = ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                           color="white" if cm[i, j] > cm.max()/2 else "black", fontsize=18)
    fig.colorbar(im)
    plt.tight_layout()
    plt.savefig(CONFUSION_PATH, dpi=150)
    plt.close()
    print(f"  Confusion matrix saved to {CONFUSION_PATH}")

    # ===== Save combined training history =====
    combined_history = {}
    for key in history1.history:
        combined_history[key] = [float(v) for v in history1.history[key]]
        if key in history2.history:
            combined_history[key].extend([float(v) for v in history2.history[key]])

    with open(HISTORY_PATH, "w") as f:
        json.dump(combined_history, f, indent=2)

    # Plot training curves
    save_training_plot(combined_history, len(history1.history.get("accuracy", [])))

    print(f"\n{'='*60}")
    print(f"  ✅ Training complete!")
    print(f"  Model: {MODEL_PATH}")
    print(f"  Accuracy: {accuracy:.2%} | F1: {f1:.2%}")
    print(f"  Precision: {precision:.2%} | Recall: {recall:.2%}")
    print(f"{'='*60}")


def save_training_plot(history, phase1_epochs):
    """Save training curves with phase boundary marker."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Accuracy
    axes[0].plot(history.get("accuracy", []), label="Train Accuracy", linewidth=2)
    axes[0].plot(history.get("val_accuracy", []), label="Val Accuracy", linewidth=2)
    axes[0].axvline(x=phase1_epochs - 0.5, color="red", linestyle="--",
                    alpha=0.5, label="Fine-tune start")
    axes[0].set_title("Model Accuracy", fontsize=13, fontweight="bold")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Accuracy")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    # Loss
    axes[1].plot(history.get("loss", []), label="Train Loss", linewidth=2)
    axes[1].plot(history.get("val_loss", []), label="Val Loss", linewidth=2)
    axes[1].axvline(x=phase1_epochs - 0.5, color="red", linestyle="--",
                    alpha=0.5, label="Fine-tune start")
    axes[1].set_title("Model Loss", fontsize=13, fontweight="bold")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Loss")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(PLOT_PATH, dpi=150)
    plt.close()
    print(f"  Training plot saved to {PLOT_PATH}")


if __name__ == "__main__":
    train()
