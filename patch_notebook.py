"""
patch_notebook.py
-----------------
Patches TextileGuard_train_v2_colab.ipynb with CPU-safe training settings
to prevent kernel crashes on Windows.

Changes made:
  1. IMG_SIZE 224 → 96   (cuts activation memory ~5.5×)
  2. BATCH_SIZE 8 → 4    (halves per-step RAM)
  3. PHASE1_EPOCHS 5 → 3 / PHASE2_EPOCHS 10 → 5
  4. FINE_TUNE_AT -20 → -10
  5. Removes all 5 augmentation layers from the model graph
  6. Adds a normalise() helper to the dataset pipeline (pixels 0→1)
  7. Uses prefetch(1) instead of AUTOTUNE to limit pipeline buffering
"""

import json, re, sys
from pathlib import Path

NB_PATH = Path(__file__).parent / "TextileGuard_train_v2_colab.ipynb"

# ── New cell source strings ────────────────────────────────────────────────────

NEW_CONFIG_SOURCE = (
    "import os\nimport json\nimport numpy as np\n\n"
    "os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'\n"
    "os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'\n\n"
    "# ── GPU / CPU memory guard (MUST be set before TF initialises) ──────────\n"
    "import tensorflow as tf\n"
    "gpus = tf.config.list_physical_devices('GPU')\n"
    "for _gpu in gpus:\n"
    "    try:\n"
    "        tf.config.experimental.set_memory_growth(_gpu, True)\n"
    "    except Exception:\n"
    "        pass\n"
    "if not gpus:\n"
    "    # CPU-only: cap thread count to avoid fork-bomb on Windows\n"
    "    tf.config.threading.set_inter_op_parallelism_threads(2)\n"
    "    tf.config.threading.set_intra_op_parallelism_threads(4)\n"
    "print(f'TF {tf.__version__} | GPUs: {len(gpus)} | Device: {\"GPU\" if gpus else \"CPU\"}')\n"
    "# ─────────────────────────────────────────────────────────────────────────\n"
    "from tensorflow import keras\n"
    "from tensorflow.keras import layers, Model\n"
    "from tensorflow.keras.applications import MobileNetV2\n"
    "from tensorflow.keras.optimizers import Adam\n"
    "from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau\n\n"
    "import matplotlib\n"
    "matplotlib.use('Agg')\n"
    "import matplotlib.pyplot as plt\n\n"
    "# ── CPU-SAFE CONFIG: IMG_SIZE=96 cuts memory ~5.5x vs 224 ──────────────\n"
    "IMG_SIZE      = 96   # 96 is a valid MobileNetV2 size; fits comfortably in RAM\n"
    "BATCH_SIZE    = 4    # Small batch prevents OOM on Windows CPU\n"
    "PHASE1_EPOCHS = 3    # Just enough to converge the head\n"
    "PHASE2_EPOCHS = 5    # Short fine-tune pass\n"
    "PHASE1_LR     = 1e-3\n"
    "PHASE2_LR     = 5e-6\n"
    "FINE_TUNE_AT  = -10  # Unfreeze only last 10 MobileNetV2 layers\n"
    "LABEL_SMOOTHING = 0.0\n"
    "DROPOUT_RATE  = 0.3\n"
    "L2_WEIGHT     = 1e-4\n"
    "VALIDATION_SPLIT = 0.2\n"
    "SEED = 42\n\n"
    "print('\\n=== TRAINING CONFIG (CPU-Safe) ===')\n"
    "print(f'IMG_SIZE    : {IMG_SIZE}')\n"
    "print(f'BATCH_SIZE  : {BATCH_SIZE}')\n"
    "print(f'PHASE1_EPOCHS: {PHASE1_EPOCHS}')\n"
    "print(f'PHASE2_EPOCHS: {PHASE2_EPOCHS}')\n"
    "print(f'FINE_TUNE_AT: {FINE_TUNE_AT} (unfreeze last {abs(FINE_TUNE_AT)} layers)')"
)

NEW_MODEL_SOURCE = (
    "def build_model(num_classes=1):\n"
    "    # NO augmentation layers inside the model graph (saves ~50 % RAM per batch).\n"
    "    # Pixels arrive already normalised to [0,1] from load_datasets().\n"
    "    inputs = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3), name='input_image')\n\n"
    "    base_model = MobileNetV2(\n"
    "        input_shape=(IMG_SIZE, IMG_SIZE, 3),\n"
    "        include_top=False,\n"
    "        weights='imagenet',\n"
    "    )\n"
    "    base_model.trainable = False\n\n"
    "    x = base_model(inputs, training=False)\n"
    "    x = layers.GlobalAveragePooling2D(name='avg_pool')(x)\n"
    "    x = layers.Dropout(DROPOUT_RATE)(x)\n"
    "    outputs = layers.Dense(1, activation='sigmoid', name='prediction')(x)\n\n"
    "    model = Model(inputs, outputs, name='textile_defect_mobilenetv2')\n"
    "    return model, base_model"
)

NEW_DATASET_SOURCE = (
    "def normalise(images, labels):\n"
    "    \"\"\"Scale uint8 pixels [0,255] to float32 [0,1] for MobileNetV2.\"\"\"\n"
    "    return tf.cast(images, tf.float32) / 255.0, labels\n\n\n"
    "def load_datasets():\n"
    "    train_ds = tf.keras.utils.image_dataset_from_directory(\n"
    "        TRAIN_DIR,\n"
    "        validation_split=VALIDATION_SPLIT,\n"
    "        subset='training',\n"
    "        seed=SEED,\n"
    "        image_size=(IMG_SIZE, IMG_SIZE),\n"
    "        batch_size=BATCH_SIZE,\n"
    "        label_mode='binary',\n"
    "    )\n\n"
    "    val_ds = tf.keras.utils.image_dataset_from_directory(\n"
    "        TRAIN_DIR,\n"
    "        validation_split=VALIDATION_SPLIT,\n"
    "        subset='validation',\n"
    "        seed=SEED,\n"
    "        image_size=(IMG_SIZE, IMG_SIZE),\n"
    "        batch_size=BATCH_SIZE,\n"
    "        label_mode='binary',\n"
    "    )\n\n"
    "    if HAS_TEST_SET:\n"
    "        test_ds = tf.keras.utils.image_dataset_from_directory(\n"
    "            TEST_DIR,\n"
    "            image_size=(IMG_SIZE, IMG_SIZE),\n"
    "            batch_size=BATCH_SIZE,\n"
    "            label_mode='binary',\n"
    "            shuffle=False,\n"
    "        )\n"
    "    else:\n"
    "        print('Using validation set as test set (dataset/test missing or empty).')\n"
    "        test_ds = val_ds\n\n"
    "    AUTOTUNE = tf.data.AUTOTUNE\n"
    "    # normalise + prefetch(1) keeps pipeline memory minimal on Windows CPU\n"
    "    train_ds = train_ds.map(normalise, num_parallel_calls=AUTOTUNE).prefetch(1)\n"
    "    val_ds   = val_ds.map(normalise,   num_parallel_calls=AUTOTUNE).prefetch(1)\n"
    "    test_ds  = test_ds.map(normalise,  num_parallel_calls=AUTOTUNE).prefetch(1)\n\n"
    "    return train_ds, val_ds, test_ds"
)

# ── Patch logic ────────────────────────────────────────────────────────────────

def patch_cell_by_id(cells, cell_id, new_source):
    for cell in cells:
        if cell.get("id") == cell_id:
            cell["source"] = new_source
            cell["outputs"] = []         # clear stale outputs
            cell["execution_count"] = None
            return True
    return False


def patch_cell_containing(cells, snippet, new_source):
    """
    Fallback: find a code cell whose source contains `snippet` and replace it.
    """
    for cell in cells:
        if cell.get("cell_type") != "code":
            continue
        src = cell.get("source", "")
        if isinstance(src, list):
            src = "".join(src)
        if snippet in src:
            cell["source"] = new_source
            cell["outputs"] = []
            cell["execution_count"] = None
            return True
    return False


def main():
    print(f"Loading notebook: {NB_PATH}")
    nb = json.loads(NB_PATH.read_text(encoding="utf-8"))
    cells = nb.get("cells", [])

    results = {}

    # 1. Config cell  (id = 6ea4b399)
    ok = patch_cell_by_id(cells, "6ea4b399", NEW_CONFIG_SOURCE)
    if not ok:
        ok = patch_cell_containing(cells, "IMG_SIZE = ", NEW_CONFIG_SOURCE)
    results["config"] = ok

    # 2. Model cell  (id = fd11128b)
    ok = patch_cell_by_id(cells, "fd11128b", NEW_MODEL_SOURCE)
    if not ok:
        ok = patch_cell_containing(cells, "build_model(", NEW_MODEL_SOURCE)
    results["model"] = ok

    # 3. Dataset cell  (id = 48a6795a)
    ok = patch_cell_by_id(cells, "48a6795a", NEW_DATASET_SOURCE)
    if not ok:
        ok = patch_cell_containing(cells, "load_datasets(", NEW_DATASET_SOURCE)
    results["dataset"] = ok

    for k, v in results.items():
        status = "✓ patched" if v else "✗ NOT FOUND"
        print(f"  {k:10s}: {status}")

    if not all(results.values()):
        print("\n[WARNING] Some cells were not found. Check cell IDs above.")
        sys.exit(1)

    NB_PATH.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"\nNotebook saved. Kernel crashes should be gone now.")
    print("Run ALL cells top-to-bottom in VS Code / JupyterLab.")


if __name__ == "__main__":
    main()
