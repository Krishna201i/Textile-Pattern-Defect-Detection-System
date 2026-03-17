"""
Image preprocessing utilities for textile defect detection.
Handles loading, resizing, normalization, and augmentation of fabric images.

Supports two normalization modes:
  - 'efficientnet': images in [0, 255] range (EfficientNet handles its own preprocessing)
  - 'legacy': images in [0, 1] range (for the old custom CNN model)
"""

import os
import numpy as np
from tensorflow.keras.preprocessing.image import ImageDataGenerator

# Image dimensions expected by the CNN model
IMG_HEIGHT = 224
IMG_WIDTH = 224
BATCH_SIZE = 32

# Use EfficientNet-style preprocessing by default (no rescale — model handles it)
NORMALIZATION_MODE = os.environ.get("NORMALIZATION_MODE", "efficientnet")


def get_data_generators(dataset_dir):
    """
    Create training and validation data generators with augmentation.

    Args:
        dataset_dir: Path to the dataset root (should contain train/ and test/ folders,
                     each with defective/ and non_defective/ subfolders).

    Returns:
        train_generator, val_generator, test_generator
    """
    train_dir = os.path.join(dataset_dir, "train")
    test_dir = os.path.join(dataset_dir, "test")

    # EfficientNet models expect [0, 255] input — their built-in preprocessing
    # handles normalization. Legacy models expect [0, 1].
    rescale_factor = None if NORMALIZATION_MODE == "efficientnet" else 1.0 / 255

    # Training data with augmentation to improve generalization
    train_datagen = ImageDataGenerator(
        rescale=rescale_factor,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.15,
        zoom_range=0.15,
        horizontal_flip=True,
        vertical_flip=True,
        fill_mode="nearest",
        validation_split=0.2,
    )

    # Test data — only rescale, no augmentation
    test_datagen = ImageDataGenerator(rescale=rescale_factor)

    train_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=(IMG_HEIGHT, IMG_WIDTH),
        batch_size=BATCH_SIZE,
        class_mode="binary",
        subset="training",
        shuffle=True,
    )

    val_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=(IMG_HEIGHT, IMG_WIDTH),
        batch_size=BATCH_SIZE,
        class_mode="binary",
        subset="validation",
        shuffle=False,
    )

    test_generator = test_datagen.flow_from_directory(
        test_dir,
        target_size=(IMG_HEIGHT, IMG_WIDTH),
        batch_size=BATCH_SIZE,
        class_mode="binary",
        shuffle=False,
    )

    return train_generator, val_generator, test_generator


def preprocess_single_image(image_path):
    """
    Preprocess a single image for prediction.

    Args:
        image_path: Path to the image file.

    Returns:
        Preprocessed image as a numpy array with shape (1, 224, 224, 3).
    """
    from tensorflow.keras.preprocessing.image import load_img, img_to_array

    img = load_img(image_path, target_size=(IMG_HEIGHT, IMG_WIDTH))
    img_array = img_to_array(img)

    # EfficientNet expects [0, 255], legacy CNN expects [0, 1]
    if NORMALIZATION_MODE != "efficientnet":
        img_array = img_array / 255.0

    return np.expand_dims(img_array, axis=0)

