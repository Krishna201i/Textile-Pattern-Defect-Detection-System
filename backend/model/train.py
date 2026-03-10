"""
Model training script for textile defect detection.
Uses a custom CNN for binary classification.
"""

import os
import sys
import json
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Dense, Dropout, Flatten, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint

from preprocess import get_data_generators, IMG_HEIGHT, IMG_WIDTH

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(os.path.dirname(BASE_DIR), "dataset")
SAVED_MODEL_DIR = os.path.join(BASE_DIR, "saved_model")
MODEL_PATH = os.path.join(SAVED_MODEL_DIR, "textile_defect_model.keras")
HISTORY_PATH = os.path.join(SAVED_MODEL_DIR, "training_history.json")
PLOT_PATH = os.path.join(SAVED_MODEL_DIR, "training_plot.png")

# Hyperparameters
EPOCHS = 20
LEARNING_RATE = 0.0001


def build_model():
    """Build a custom CNN-based binary classification model."""
    model = Sequential([
        Conv2D(32, (3, 3), activation="relu", padding="same", input_shape=(IMG_HEIGHT, IMG_WIDTH, 3)),
        BatchNormalization(),
        MaxPooling2D((2, 2)),

        Conv2D(64, (3, 3), activation="relu", padding="same"),
        BatchNormalization(),
        MaxPooling2D((2, 2)),

        Conv2D(128, (3, 3), activation="relu", padding="same"),
        BatchNormalization(),
        MaxPooling2D((2, 2)),

        Conv2D(256, (3, 3), activation="relu", padding="same"),
        BatchNormalization(),
        MaxPooling2D((2, 2)),

        Flatten(),
        Dense(256, activation="relu"),
        Dropout(0.4),
        Dense(64, activation="relu"),
        Dropout(0.25),
        Dense(1, activation="sigmoid"),
    ])

    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )

    return model


def save_training_plot(history):
    """Save accuracy and loss plots to disk."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

    ax1.plot(history["accuracy"], label="Train Accuracy")
    ax1.plot(history["val_accuracy"], label="Val Accuracy")
    ax1.set_title("Model Accuracy")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Accuracy")
    ax1.legend()

    ax2.plot(history["loss"], label="Train Loss")
    ax2.plot(history["val_loss"], label="Val Loss")
    ax2.set_title("Model Loss")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Loss")
    ax2.legend()

    plt.tight_layout()
    plt.savefig(PLOT_PATH, dpi=150)
    plt.close()
    print(f"Training plot saved to {PLOT_PATH}")


def main():
    print("=" * 50)
    print("Textile Defect Detection - Model Training")
    print("=" * 50)

    # Verify dataset exists
    train_dir = os.path.join(DATASET_DIR, "train")
    if not os.path.exists(train_dir):
        print(f"ERROR: Dataset not found at {DATASET_DIR}")
        print("Please place your images in:")
        print(f"  {os.path.join(DATASET_DIR, 'train', 'defective')}/")
        print(f"  {os.path.join(DATASET_DIR, 'train', 'non_defective')}/")
        print(f"  {os.path.join(DATASET_DIR, 'test', 'defective')}/")
        print(f"  {os.path.join(DATASET_DIR, 'test', 'non_defective')}/")
        sys.exit(1)

    # Load data
    print("\nLoading dataset...")
    train_gen, val_gen, test_gen = get_data_generators(DATASET_DIR)
    print(f"Classes: {train_gen.class_indices}")
    print(f"Training samples: {train_gen.samples}")
    print(f"Validation samples: {val_gen.samples}")
    print(f"Test samples: {test_gen.samples}")

    # Build model
    print("\nBuilding CNN model...")
    model = build_model()
    model.summary()

    # Callbacks
    callbacks = [
        EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
            verbose=1,
        ),
        ModelCheckpoint(
            MODEL_PATH,
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1,
        ),
    ]

    # Train
    print(f"\nTraining for up to {EPOCHS} epochs...")
    history = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS,
        callbacks=callbacks,
    )

    # Save training history
    hist_dict = {k: [float(v) for v in vals] for k, vals in history.history.items()}
    with open(HISTORY_PATH, "w") as f:
        json.dump(hist_dict, f, indent=2)

    # Save training plot
    save_training_plot(hist_dict)

    # Evaluate on test set
    print("\nEvaluating on test set...")
    test_loss, test_acc = model.evaluate(test_gen)
    print(f"Test Accuracy: {test_acc:.4f}")
    print(f"Test Loss: {test_loss:.4f}")

    # Save final model
    model.save(MODEL_PATH)
    print(f"\nModel saved to {MODEL_PATH}")
    print("Training complete!")


if __name__ == "__main__":
    main()
