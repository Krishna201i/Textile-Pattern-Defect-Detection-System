"""
Download Kaggle fabric defect dataset and organize into train/test splits.
Uses kagglehub to download, then sorts images into the right folders.

Usage:
    pip install kagglehub
    python download_and_organize.py
"""

import os
import shutil
import random

random.seed(42)

# Install kagglehub if needed
try:
    import kagglehub
except ImportError:
    print("Installing kagglehub...")
    os.system("pip install kagglehub")
    import kagglehub

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAIN_DEF = os.path.join(BASE_DIR, "train", "defective")
TRAIN_NONDEF = os.path.join(BASE_DIR, "train", "non_defective")
TEST_DEF = os.path.join(BASE_DIR, "test", "defective")
TEST_NONDEF = os.path.join(BASE_DIR, "test", "non_defective")

TRAIN_SPLIT = 0.8  # 80% train, 20% test
IMG_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}


def is_image(filename):
    return os.path.splitext(filename)[1].lower() in IMG_EXTENSIONS


def collect_images(root_dir):
    """Recursively collect all image file paths from a directory."""
    images = []
    for dirpath, _, filenames in os.walk(root_dir):
        for f in filenames:
            if is_image(f):
                images.append(os.path.join(dirpath, f))
    return images


def classify_images(dataset_path):
    """
    Classify images from the downloaded dataset into defective/non_defective lists.
    Handles both dataset structures:
      - rmshashi: folders named 'hole', 'horizontal', 'vertical' (defective) and 'captured' (non-defective)
      - nexuswho: may have 'Defected'/'Non-Defected' or similar naming
    """
    defective = []
    non_defective = []

    # Keywords indicating defective images
    defect_keywords = ["hole", "horizontal", "vertical", "defect", "stain",
                       "scratch", "tear", "damaged", "broken", "fault"]
    # Keywords indicating non-defective images
    clean_keywords = ["captured", "clean", "good", "non_defect", "non-defect",
                      "defect_free", "defect-free", "normal", "no_defect"]

    for dirpath, dirnames, filenames in os.walk(dataset_path):
        folder_name = os.path.basename(dirpath).lower()
        images_in_folder = [os.path.join(dirpath, f) for f in filenames if is_image(f)]

        if not images_in_folder:
            continue

        # Check folder name to classify
        is_defective = any(kw in folder_name for kw in defect_keywords)
        is_clean = any(kw in folder_name for kw in clean_keywords)

        if is_defective and not is_clean:
            defective.extend(images_in_folder)
        elif is_clean and not is_defective:
            non_defective.extend(images_in_folder)
        elif "non" in folder_name or "free" in folder_name:
            non_defective.extend(images_in_folder)
        else:
            # If we can't tell from folder name, check parent folders
            full_path_lower = dirpath.lower()
            if any(kw in full_path_lower for kw in defect_keywords):
                defective.extend(images_in_folder)
            elif any(kw in full_path_lower for kw in clean_keywords):
                non_defective.extend(images_in_folder)
            else:
                # Unknown — skip these
                print(f"  [?] Skipping ambiguous folder: {dirpath} ({len(images_in_folder)} images)")

    return defective, non_defective


def copy_images(image_list, dest_dir, prefix="img"):
    """Copy images to destination directory with sequential naming."""
    os.makedirs(dest_dir, exist_ok=True)
    for i, src in enumerate(image_list):
        ext = os.path.splitext(src)[1]
        dst = os.path.join(dest_dir, f"{prefix}_{i+1:04d}{ext}")
        shutil.copy2(src, dst)


def clear_existing():
    """Remove existing synthetic images before populating with real ones."""
    for folder in [TRAIN_DEF, TRAIN_NONDEF, TEST_DEF, TEST_NONDEF]:
        if os.path.exists(folder):
            count = len([f for f in os.listdir(folder) if is_image(f)])
            if count > 0:
                print(f"  Clearing {count} existing images from {os.path.basename(os.path.dirname(folder))}/{os.path.basename(folder)}")
                for f in os.listdir(folder):
                    if is_image(f):
                        os.remove(os.path.join(folder, f))


def main():
    print("=" * 60)
    print("  Kaggle Fabric Defect Dataset Downloader & Organizer")
    print("=" * 60)

    # Download dataset (smaller one first — 233 MB)
    print("\n[1/4] Downloading fabric defect dataset from Kaggle...")
    try:
        path = kagglehub.dataset_download("rmshashi/fabric-defect-dataset")
        print(f"  Downloaded to: {path}")
    except Exception as e:
        print(f"  Error downloading rmshashi dataset: {e}")
        print("  Trying alternative dataset...")
        try:
            path = kagglehub.dataset_download("nexuswho/fabric-defects-dataset")
            print(f"  Downloaded to: {path}")
        except Exception as e2:
            print(f"  Error: {e2}")
            print("  Please download manually from Kaggle.")
            return

    # Classify images
    print("\n[2/4] Classifying images...")
    defective, non_defective = classify_images(path)
    print(f"  Found {len(defective)} defective images")
    print(f"  Found {len(non_defective)} non-defective images")

    if len(defective) == 0 and len(non_defective) == 0:
        print("\n  ERROR: No images classified. Listing dataset structure:")
        for dirpath, dirnames, filenames in os.walk(path):
            img_count = len([f for f in filenames if is_image(f)])
            if img_count > 0:
                print(f"    {dirpath} -> {img_count} images")
        return

    # Shuffle and split
    print("\n[3/4] Splitting into train/test...")
    random.shuffle(defective)
    random.shuffle(non_defective)

    split_def = int(len(defective) * TRAIN_SPLIT)
    split_nondef = int(len(non_defective) * TRAIN_SPLIT)

    train_def = defective[:split_def]
    test_def = defective[split_def:]
    train_nondef = non_defective[:split_nondef]
    test_nondef = non_defective[split_nondef:]

    print(f"  Train: {len(train_def)} defective, {len(train_nondef)} non-defective")
    print(f"  Test:  {len(test_def)} defective, {len(test_nondef)} non-defective")

    # Clear old data and copy
    print("\n[4/4] Copying images to dataset folders...")
    clear_existing()

    copy_images(train_def, TRAIN_DEF, "defective")
    copy_images(test_def, TEST_DEF, "defective")
    copy_images(train_nondef, TRAIN_NONDEF, "non_defective")
    copy_images(test_nondef, TEST_NONDEF, "non_defective")

    total = len(train_def) + len(test_def) + len(train_nondef) + len(test_nondef)
    print(f"\n{'=' * 60}")
    print(f"  Done! {total} real fabric images organized.")
    print(f"  Train: {TRAIN_DEF}")
    print(f"  Test:  {TEST_DEF}")
    print(f"{'=' * 60}")
    print(f"\n  Next: cd backend\\model && python train.py")


if __name__ == "__main__":
    main()
