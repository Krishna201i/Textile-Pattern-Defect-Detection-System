import json, sys
from pathlib import Path

NB_PATH = Path(__file__).parent / "TextileGuard_train_v2_colab.ipynb"

NEW_CONFIG = """\
import os
import json
import numpy as np

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import tensorflow as tf
gpus = tf.config.list_physical_devices('GPU')
for _gpu in gpus:
    try:
        tf.config.experimental.set_memory_growth(_gpu, True)
    except Exception:
        pass
if not gpus:
    tf.config.threading.set_inter_op_parallelism_threads(2)
    tf.config.threading.set_intra_op_parallelism_threads(4)
print(f'TF {tf.__version__} | GPUs: {len(gpus)} | CPU-only mode')
from tensorflow import keras
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# CPU-SAFE CONFIG: IMG_SIZE=96 cuts activation RAM ~5.5x vs 224
IMG_SIZE      = 96
BATCH_SIZE    = 4
PHASE1_EPOCHS = 3
PHASE2_EPOCHS = 5
PHASE1_LR     = 1e-3
PHASE2_LR     = 5e-6
FINE_TUNE_AT  = -10
LABEL_SMOOTHING = 0.0
DROPOUT_RATE  = 0.3
L2_WEIGHT     = 1e-4
VALIDATION_SPLIT = 0.2
SEED = 42

print(f'IMG_SIZE={IMG_SIZE}  BATCH={BATCH_SIZE}  P1_epochs={PHASE1_EPOCHS}  P2_epochs={PHASE2_EPOCHS}')
"""

NEW_MODEL = """\
def build_model(num_classes=1):
    # No augmentation layers inside the model - saves ~50% RAM per batch on CPU.
    # Pixels arrive normalised to [0,1] by load_datasets().
    inputs = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3), name='input_image')
    base_model = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights='imagenet',
    )
    base_model.trainable = False
    x = base_model(inputs, training=False)
    x = layers.GlobalAveragePooling2D(name='avg_pool')(x)
    x = layers.Dropout(DROPOUT_RATE)(x)
    outputs = layers.Dense(1, activation='sigmoid', name='prediction')(x)
    model = Model(inputs, outputs, name='textile_defect_mobilenetv2')
    return model, base_model
"""

NEW_DATASET = """\
def normalise(images, labels):
    return tf.cast(images, tf.float32) / 255.0, labels


def load_datasets():
    train_ds = tf.keras.utils.image_dataset_from_directory(
        TRAIN_DIR,
        validation_split=VALIDATION_SPLIT,
        subset='training',
        seed=SEED,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode='binary',
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        TRAIN_DIR,
        validation_split=VALIDATION_SPLIT,
        subset='validation',
        seed=SEED,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        label_mode='binary',
    )
    if HAS_TEST_SET:
        test_ds = tf.keras.utils.image_dataset_from_directory(
            TEST_DIR,
            image_size=(IMG_SIZE, IMG_SIZE),
            batch_size=BATCH_SIZE,
            label_mode='binary',
            shuffle=False,
        )
    else:
        print('Using val set as test set (no dataset/test found).')
        test_ds = val_ds
    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.map(normalise, num_parallel_calls=AUTOTUNE).prefetch(1)
    val_ds   = val_ds.map(normalise,   num_parallel_calls=AUTOTUNE).prefetch(1)
    test_ds  = test_ds.map(normalise,  num_parallel_calls=AUTOTUNE).prefetch(1)
    return train_ds, val_ds, test_ds
"""

PATCHES = {
    "6ea4b399": ("IMG_SIZE = ",            NEW_CONFIG),
    "fd11128b": ("build_augmentation_layers", NEW_MODEL),
    "48a6795a": ("load_datasets",          NEW_DATASET),
}

def main():
    print("Loading:", NB_PATH)
    nb = json.loads(NB_PATH.read_text(encoding="utf-8"))
    cells = nb["cells"]
    patched = {}

    # Pass 1: by cell id
    for cell in cells:
        cid = cell.get("id", "")
        if cid in PATCHES:
            cell["source"] = PATCHES[cid][1]
            cell["outputs"] = []
            cell["execution_count"] = None
            patched[cid] = True
            print(f"  [OK] Patched by id: {cid}")

    # Pass 2: fallback by snippet
    for cid, (snippet, src) in PATCHES.items():
        if cid in patched:
            continue
        for cell in cells:
            if cell.get("cell_type") != "code":
                continue
            s = cell.get("source", "")
            if isinstance(s, list):
                s = "".join(s)
            if snippet in s:
                cell["source"] = src
                cell["outputs"] = []
                cell["execution_count"] = None
                patched[cid] = True
                print(f"  [OK] Patched by snippet ({snippet!r}): {cid}")
                break
        else:
            print(f"  [WARN] Could not find cell for {cid!r} (snippet: {snippet!r})")

    NB_PATH.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
    print("Notebook saved successfully.")

if __name__ == "__main__":
    main()
