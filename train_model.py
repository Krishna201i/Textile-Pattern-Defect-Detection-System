"""
train_model.py  —  CPU-safe standalone trainer for TextileGuard
================================================================
Run this script DIRECTLY (not inside Jupyter) to avoid kernel crashes:

    python train_model.py

Why a standalone script instead of the notebook?
  - No Jupyter kernel overhead (saves ~300-500 MB RAM)
  - Uses ImageDataGenerator (simpler memory model than tf.data pipelines)
  - Uses MobileNetV2 alpha=0.35 (75% fewer params vs full model)
  - Phase-1 only by default (no fine-tuning, faster, less RAM)
  - Explicit gc.collect() between steps

Output:
  backend/saved_model/textile_defect_model.keras
"""

import os, gc, json, sys
from pathlib import Path

# ── 1. Silence TF noise BEFORE importing TF ──────────────────────────────────
os.environ["TF_CPP_MIN_LOG_LEVEL"]   = "2"
os.environ["TF_ENABLE_ONEDNN_OPTS"]  = "0"

import numpy as np

import tensorflow as tf
# Cap CPU threads BEFORE any model ops
tf.config.threading.set_inter_op_parallelism_threads(1)
tf.config.threading.set_intra_op_parallelism_threads(2)

from tensorflow import keras
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import (
    EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
)

print(f"TF {tf.__version__} | CPU-only mode")

# ── 2. Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).resolve().parent
DATASET_DIR  = SCRIPT_DIR / "dataset"
TRAIN_DIR    = DATASET_DIR / "train"
TEST_DIR     = DATASET_DIR / "test"
SAVED_MODEL  = SCRIPT_DIR / "backend" / "saved_model"
MODEL_PATH   = SAVED_MODEL / "textile_defect_model.keras"
HISTORY_PATH = SAVED_MODEL / "training_history.json"

SAVED_MODEL.mkdir(parents=True, exist_ok=True)

# ── 3. Config ─────────────────────────────────────────────────────────────────
IMG_SIZE    = 96          # 96 is valid for MobileNetV2; ~5.5x less RAM than 224
BATCH_SIZE  = 8           # ImageDataGenerator uses much less RAM than tf.data
EPOCHS      = 10          # EarlyStopping will cut this short
LR          = 1e-3
SEED        = 42

print(f"IMG_SIZE={IMG_SIZE}  BATCH={BATCH_SIZE}  EPOCHS={EPOCHS}")
print(f"TRAIN_DIR : {TRAIN_DIR}")
print(f"MODEL_PATH: {MODEL_PATH}")

# ── 4. Verify dataset ─────────────────────────────────────────────────────────
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}

def count_images(folder):
    folder = Path(folder)
    if not folder.is_dir():
        return 0
    return sum(1 for f in folder.rglob("*") if f.suffix.lower() in IMAGE_EXTS)

train_count = count_images(TRAIN_DIR)
test_count  = count_images(TEST_DIR)
print(f"Train images: {train_count}  |  Test images: {test_count}")

if train_count == 0:
    sys.exit("ERROR: No training images found. Check TRAIN_DIR path.")

# ── 5. Data generators (ImageDataGenerator = much lower RAM than tf.data) ────
# Minimal augmentation - only horizontal flip to reduce per-batch compute
train_gen = ImageDataGenerator(
    rescale=1.0 / 255,
    horizontal_flip=True,
    validation_split=0.2,
)
val_gen = ImageDataGenerator(
    rescale=1.0 / 255,
    validation_split=0.2,
)

train_flow = train_gen.flow_from_directory(
    TRAIN_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="binary",
    subset="training",
    seed=SEED,
    shuffle=True,
)
val_flow = val_gen.flow_from_directory(
    TRAIN_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="binary",
    subset="validation",
    seed=SEED,
    shuffle=False,
)

print(f"Classes: {train_flow.class_indices}")  # should be {defective:0, non_defective:1}

# ── 6. Class weights (handles imbalance) ─────────────────────────────────────
total = train_flow.n
counts = {}
for cls_name, cls_idx in train_flow.class_indices.items():
    counts[cls_idx] = sum(
        1 for f in (TRAIN_DIR / cls_name).rglob("*")
        if f.suffix.lower() in IMAGE_EXTS
    )
n_classes = len(counts)
class_weight = {
    i: total / (n_classes * max(1, counts.get(i, 1)))
    for i in range(n_classes)
}
print(f"Class weights: {class_weight}")

# ── 7. Build model ───────────────────────────────────────────────────────────
gc.collect()

print("\nBuilding MobileNetV2 (alpha=0.35) ...")
# alpha=0.35 → 75% fewer parameters → fits easily in 4-8 GB RAM
base = MobileNetV2(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights="imagenet",
    alpha=0.35,           # << key: lightweight variant
)
base.trainable = False

inputs  = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
x       = base(inputs, training=False)
x       = layers.GlobalAveragePooling2D()(x)
x       = layers.Dropout(0.3)(x)
outputs = layers.Dense(1, activation="sigmoid")(x)
model   = Model(inputs, outputs, name="textile_defect_mobilenetv2")

model.compile(
    optimizer=keras.optimizers.Adam(LR),
    loss="binary_crossentropy",
    metrics=["accuracy",
             keras.metrics.Precision(name="precision"),
             keras.metrics.Recall(name="recall")],
)
model.summary()
gc.collect()

# ── 8. Train ─────────────────────────────────────────────────────────────────
callbacks = [
    EarlyStopping(
        monitor="val_loss", patience=4,
        restore_best_weights=True, verbose=1
    ),
    ModelCheckpoint(
        str(MODEL_PATH), monitor="val_accuracy",
        save_best_only=True, verbose=1, mode="max"
    ),
    ReduceLROnPlateau(
        monitor="val_loss", factor=0.5, patience=2,
        min_lr=1e-7, verbose=1
    ),
]

print("\n=== Training ===")
history = model.fit(
    train_flow,
    epochs=EPOCHS,
    validation_data=val_flow,
    class_weight=class_weight,
    callbacks=callbacks,
    verbose=1,
)
gc.collect()

# ── 9. Save history ───────────────────────────────────────────────────────────
hist_data = {k: [float(v) for v in vals] for k, vals in history.history.items()}
HISTORY_PATH.write_text(json.dumps(hist_data, indent=2))
print(f"History saved to {HISTORY_PATH}")

# ── 10. Quick evaluation ──────────────────────────────────────────────────────
if test_count > 0:
    test_gen = ImageDataGenerator(rescale=1.0 / 255)
    test_flow = test_gen.flow_from_directory(
        TEST_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="binary",
        shuffle=False,
    )
    results = model.evaluate(test_flow, verbose=0)
    names   = model.metrics_names
    print("\n=== Test Results ===")
    for n, v in zip(names, results):
        print(f"  {n}: {v:.4f}")
else:
    print("\n(No test set found; skipping evaluation)")

print(f"\nModel saved to: {MODEL_PATH}")
print("Done! The backend will load this model automatically on the next request.")
