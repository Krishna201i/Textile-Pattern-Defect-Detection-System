"""
Quick training script for Textile Defect Detection (demo mode).

This script creates a small synthetic dataset (if none exists) and trains a
MobileNetV2-based binary classifier for a few epochs. Intended to produce a
.keras model quickly for local development and UI testing when you don't have
real training data yet.

Usage:
    cd backend
    python -u model/quick_train.py --epochs 3 --samples 80 --no-imagenet

Notes:
- For faster runs without downloading ImageNet weights, pass --no-imagenet.
- The resulting model is saved to backend/saved_model/textile_defect_model.keras
  (the same path expected by the backend prediction code).
"""

import os
import argparse
import random






































































































































































    main()if __name__ == '__main__':    train_model(epochs=args.epochs, batch_size=16, use_imagenet=args.use_imagenet)        generate_synthetic_dataset(samples_per_class=args.samples)    if not args.no_generate:    args = parse_args()def main():    return p.parse_args()    p.add_argument('--no-generate', dest='no_generate', action='store_true', help='Do not generate synthetic dataset')    p.add_argument('--use-imagenet', dest='use_imagenet', action='store_true', help='Use ImageNet pretrained weights')    p.add_argument('--samples', '-s', type=int, default=100, help='samples per class (train+test)')    p.add_argument('--epochs', '-e', type=int, default=3)    p = argparse.ArgumentParser(description='Quick trainer for textile defect demo model')def parse_args():    print(f"Model saved to {MODEL_PATH}")    model.save(str(MODEL_PATH))    SAVED_MODEL_DIR.mkdir(parents=True, exist_ok=True)    model.fit(train_generator, validation_data=val_generator, epochs=epochs, verbose=2)    print(model.summary())    model = build_model(use_imagenet=use_imagenet)    )        shuffle=False        class_mode='binary',        batch_size=batch_size,        target_size=IMG_SIZE,        str(DATASET_DIR / 'test'),    test_generator = test_datagen.flow_from_directory(    )        shuffle=False        subset='validation',        class_mode='binary',        batch_size=batch_size,        target_size=IMG_SIZE,        str(DATASET_DIR / 'train'),    val_generator = train_datagen.flow_from_directory(    )        shuffle=True        subset='training',        class_mode='binary',        batch_size=batch_size,        target_size=IMG_SIZE,        str(DATASET_DIR / 'train'),    train_generator = train_datagen.flow_from_directory(    test_datagen = ImageDataGenerator(rescale=1.0 / 255)                                       validation_split=0.1)                                       horizontal_flip=True,                                       zoom_range=0.1,                                       height_shift_range=0.1,                                       width_shift_range=0.1,                                       rotation_range=15,    train_datagen = ImageDataGenerator(rescale=1.0 / 255,    # Create data generatorsdef train_model(epochs=3, batch_size=16, use_imagenet=False):    return model    model.compile(optimizer=Adam(learning_rate=lr), loss='binary_crossentropy', metrics=['accuracy'])    model = Model(inputs=base.input, outputs=out)    out = Dense(1, activation='sigmoid')(x)    x = Dropout(0.3)(x)    x = Dense(128, activation='relu')(x)    x = GlobalAveragePooling2D()(x)    x = base.output    base.trainable = False    base = MobileNetV2(weights=weights, include_top=False, input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3))    weights = 'imagenet' if use_imagenet else Nonedef build_model(use_imagenet=True, lr=1e-4):    print(f"Synthetic dataset generated under {DATASET_DIR} (train/test).")                img.save(fname, quality=85)                fname = out_dir / f'quick_{cls}_{i:04d}.jpg'                    img = _add_defect(img)                if cls == 'defective':                img = _create_texture(base_color=(random.randint(120, 230), random.randint(110, 210), random.randint(100, 200)))            for i in range(count):                    pass                except Exception:                    fn.unlink()                try:            for fn in list(out_dir.glob('quick_*.jpg')):            # Remove old quick_ files to avoid accumulation            out_dir = DATASET_DIR / split / cls        for cls in ('non_defective', 'defective'):    for split, count in (('train', total_train), ('test', total_test)):    total_test = max(1, int(samples_per_class * test_split))    total_train = int(samples_per_class * (1 - test_split))    make_dirs()def generate_synthetic_dataset(samples_per_class=100, test_split=0.2):    return img.filter(ImageFilter.GaussianBlur(radius=1.0))    # Slight blur to simulate real defects        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(8, 8, 8))        r = random.randint(6, 20)        cy = random.randint(20, h - 20)        cx = random.randint(20, w - 20)    else:        draw.line([(x1, y1), (x2, y2)], fill=(10, 10, 10), width=random.randint(2, 6))        y2 = random.randint(0, h)        x2 = random.randint(10, w - 10)        y1 = random.randint(0, h)        x1 = random.randint(10, w - 10)    if choice == 'line':    choice = random.choice(['line', 'spot'])    w, h = img.size    draw = ImageDraw.Draw(img)    """Draw a simple defect (line or spot) onto the image."""def _add_defect(img: Image.Image):    return img.filter(ImageFilter.SMOOTH)    img = Image.blend(img, noise, alpha=0.06)    noise = Image.effect_noise(IMG_SIZE, random.uniform(6, 30)).convert('RGB')    # Add noise layer        draw.line([(i, 0), (i, h)], fill=shade, width=1)        shade = tuple(max(0, c - random.randint(0, 18)) for c in base_color)    for i in range(0, w, 6):    # Add subtle vertical lines/stripes    w, h = IMG_SIZE    draw = ImageDraw.Draw(img)    img = Image.new('RGB', IMG_SIZE, color=base_color)    """Create a simple fabric-like textured image."""def _create_texture(base_color=(200, 180, 160)):            path.mkdir(parents=True, exist_ok=True)            path = DATASET_DIR / split / cls        for cls in ('defective', 'non_defective'):    for split in ('train', 'test'):def make_dirs():IMG_SIZE = (224, 224)MODEL_PATH = SAVED_MODEL_DIR / 'textile_defect_model.keras'SAVED_MODEL_DIR = ROOT / 'saved_model'TEST_DIR = DATASET_DIR / 'test'TRAIN_DIR = DATASET_DIR / 'train'DATASET_DIR = ROOT.parent / 'dataset'ROOT = HERE.parentHERE = Path(__file__).resolve().parent# Pathsfrom tensorflow.keras.preprocessing.image import ImageDataGeneratorfrom tensorflow.keras.optimizers import Adamfrom tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropoutfrom tensorflow.keras.models import Modelfrom tensorflow.keras.applications import MobileNetV2import numpy as npfrom PIL import Image, ImageDraw, ImageFilterfrom pathlib import Pathimport numpy as np

from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.preprocessing.image import ImageDataGenerator

# Paths
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATASET_DIR = os.path.abspath(os.path.join(ROOT, '..', 'dataset'))
TRAIN_DIR = os.path.join(DATASET_DIR, 'train')
TEST_DIR = os.path.join(DATASET_DIR, 'test')
SAVED_MODEL_DIR = os.path.join(ROOT, 'saved_model')
MODEL_PATH = os.path.join(SAVED_MODEL_DIR, 'textile_defect_model.keras')

IMG_SIZE = (224, 224)


def make_dirs():
    for split in ('train', 'test'):
        for cls in ('defective', 'non_defective'):
            path = os.path.join(DATASET_DIR, split, cls)
            os.makedirs(path, exist_ok=True)


def _create_texture(base_color=(200, 180, 160)):
    """Create a simple fabric-like textured image."""
    img = Image.new('RGB', IMG_SIZE, color=base_color)
    draw = ImageDraw.Draw(img)
    w, h = IMG_SIZE
    # Add subtle lines/stripes
    for i in range(0, w, 6):
        shade = tuple(max(0, c - random.randint(0, 18)) for c in base_color)
        draw.line([(i, 0), (i, h)], fill=shade, width=1)
    # Add noise
    noise = Image.effect_noise(IMG_SIZE, random.uniform(10, 40)).convert('RGB')
    img = Image.blend(img, noise, alpha=0.08)
    return img.filter(ImageFilter.SMOOTH)


def _add_defect(img: Image.Image):
    """Draw a simple defect (line or spot) onto the image."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    choice = random.choice(['line', 'spot'])
    if choice == 'line':
        x1 = random.randint(10, w - 10)
        y1 = random.randint(0, h)
        x2 = random.randint(10, w - 10)
        y2 = random.randint(0, h)
        draw.line([(x1, y1), (x2, y2)], fill=(20, 20, 20), width=random.randint(2, 6))
    else:
        cx = random.randint(20, w - 20)
        cy = random.randint(20, h - 20)
        r = random.randint(6, 20)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(10, 10, 10))
    # Slight blur to simulate real defects
    return img.filter(ImageFilter.GaussianBlur(radius=1.2))


def generate_synthetic_dataset(samples_per_class=100, test_split=0.2):
    make_dirs()
    total_train = int(samples_per_class * (1 - test_split))
    total_test = int(samples_per_class * test_split)

    # Clear any existing small dataset images to avoid duplicates
    # (only if directory was previously created by this script)
    # We'll overwrite existing files with our generated ones.

    for split, count in (('train', total_train), ('test', total_test)):
        for cls in ('non_defective', 'defective'):
            out_dir = os.path.join(DATASET_DIR, split, cls)
            # remove old generated files prefixed with 'quick_'
            for fn in os.listdir(out_dir):
                if fn.startswith('quick_'):
                    try:
                        os.remove(os.path.join(out_dir, fn))
                    except Exception:
                        pass

            for i in range(count):
                img = _create_texture(base_color=(random.randint(120, 230), random.randint(110, 210), random.randint(100, 200)))
                if cls == 'defective':
                    img = _add_defect(img)
                fname = f'quick_{cls}_{i:04d}.jpg'
                img.save(os.path.join(out_dir, fname), quality=85)

    print(f"Synthetic dataset generated under {DATASET_DIR} (train/test).")


def build_model(use_imagenet=True, lr=1e-4):
    weights = 'imagenet' if use_imagenet else None
    base = MobileNetV2(weights=weights, include_top=False, input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3))
    base.trainable = False
    x = base.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(128, activation='relu')(x)
    x = Dropout(0.3)(x)
    out = Dense(1, activation='sigmoid')(x)
    model = Model(inputs=base.input, outputs=out)
    model.compile(optimizer=Adam(learning_rate=lr), loss='binary_crossentropy', metrics=['accuracy'])
    return model


def train_model(epochs=3, batch_size=16, use_imagenet=False):
    # Create data generators
    train_datagen = ImageDataGenerator(rescale=1.0 / 255,
                                       rotation_range=15,
                                       width_shift_range=0.1,
                                       height_shift_range=0.1,
                                       zoom_range=0.1,
                                       horizontal_flip=True)
    test_datagen = ImageDataGenerator(rescale=1.0 / 255)

    train_generator = train_datagen.flow_from_directory(
        os.path.join(DATASET_DIR, 'train'),
        target_size=IMG_SIZE,
        batch_size=batch_size,
        class_mode='binary'
    )
    test_generator = test_datagen.flow_from_directory(
        os.path.join(DATASET_DIR, 'test'),
        target_size=IMG_SIZE,
        batch_size=batch_size,
        class_mode='binary',
        shuffle=False
    )

    model = build_model(use_imagenet=use_imagenet)
    print(model.summary())

    model.fit(train_generator, validation_data=test_generator, epochs=epochs)

    os.makedirs(SAVED_MODEL_DIR, exist_ok=True)
    model.save(MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")


def parse_args():
    p = argparse.ArgumentParser(description='Quick trainer for textile defect demo model')
    p.add_argument('--epochs', '-e', type=int, default=3)
    p.add_argument('--samples', '-s', type=int, default=100, help='samples per class (train+test)')
    p.add_argument('--use-imagenet', dest='use_imagenet', action='store_true', help='Use ImageNet pretrained weights')
    p.add_argument('--no-generate', dest='no_generate', action='store_true', help='Do not generate synthetic dataset')
    return p.parse_args()


def main():
    args = parse_args()
    if not args.no_generate:
        generate_synthetic_dataset(samples_per_class=args.samples)
    train_model(epochs=args.epochs, batch_size=16, use_imagenet=args.use_imagenet)


if __name__ == '__main__':
    main()
