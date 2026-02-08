"""
Generate a synthetic textile fabric dataset for defect detection.

Creates realistic-looking fabric patterns (weave, stripe, grid) and adds
defects (holes, stains, scratches, tears) to produce defective samples.

Usage:
    python generate_dataset.py
"""

import os
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR)

SPLITS = {
    "train": {"defective": 120, "non_defective": 120},
    "test": {"defective": 30, "non_defective": 30},
}

IMG_SIZE = 256


# ---------------------------------------------------------------------------
# Fabric pattern generators
# ---------------------------------------------------------------------------

def _random_fabric_color():
    """Return a random base color typical of fabric."""
    palettes = [
        (180, 160, 140),  # beige
        (100, 110, 130),  # grey-blue
        (140, 120, 100),  # brown
        (200, 190, 170),  # cream
        (160, 150, 160),  # mauve-grey
        (120, 140, 120),  # sage green
        (170, 140, 130),  # dusty rose
        (110, 100, 120),  # lavender grey
    ]
    base = random.choice(palettes)
    # small jitter
    return tuple(min(255, max(0, c + random.randint(-15, 15))) for c in base)


def generate_weave_pattern(size=IMG_SIZE):
    """Generate a plain-weave fabric texture."""
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)
    base = _random_fabric_color()
    dark = tuple(max(0, c - 30) for c in base)
    light = tuple(min(255, c + 20) for c in base)

    spacing = random.randint(4, 8)
    for y in range(0, size, spacing):
        color = dark if (y // spacing) % 2 == 0 else light
        draw.rectangle([0, y, size, y + spacing - 1], fill=color)
    for x in range(0, size, spacing):
        if (x // spacing) % 2 == 0:
            for y in range(0, size, spacing * 2):
                draw.rectangle([x, y, x + spacing - 1, y + spacing - 1], fill=dark)

    # add subtle noise for realism
    arr = np.array(img, dtype=np.float32)
    noise = np.random.normal(0, 5, arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def generate_stripe_pattern(size=IMG_SIZE):
    """Generate a striped fabric texture."""
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)
    base = _random_fabric_color()
    alt = tuple(min(255, max(0, c + random.randint(-40, 40))) for c in base)

    stripe_w = random.randint(6, 16)
    vertical = random.random() > 0.5

    for i in range(0, size, stripe_w):
        color = base if (i // stripe_w) % 2 == 0 else alt
        if vertical:
            draw.rectangle([i, 0, i + stripe_w - 1, size], fill=color)
        else:
            draw.rectangle([0, i, size, i + stripe_w - 1], fill=color)

    arr = np.array(img, dtype=np.float32)
    noise = np.random.normal(0, 4, arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def generate_grid_pattern(size=IMG_SIZE):
    """Generate a grid / plaid fabric texture."""
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)
    base = _random_fabric_color()
    line_color = tuple(max(0, c - 50) for c in base)

    draw.rectangle([0, 0, size, size], fill=base)
    spacing = random.randint(10, 24)
    width = random.randint(1, 3)

    for x in range(0, size, spacing):
        draw.line([(x, 0), (x, size)], fill=line_color, width=width)
    for y in range(0, size, spacing):
        draw.line([(0, y), (size, y)], fill=line_color, width=width)

    arr = np.array(img, dtype=np.float32)
    noise = np.random.normal(0, 4, arr.shape)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def generate_fabric():
    """Randomly pick a fabric pattern."""
    gen = random.choice([generate_weave_pattern, generate_stripe_pattern, generate_grid_pattern])
    return gen()


# ---------------------------------------------------------------------------
# Defect generators
# ---------------------------------------------------------------------------

def add_hole(img):
    """Add a dark hole/tear defect."""
    draw = ImageDraw.Draw(img)
    cx = random.randint(40, IMG_SIZE - 40)
    cy = random.randint(40, IMG_SIZE - 40)
    rx = random.randint(8, 25)
    ry = random.randint(8, 25)
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(20, 15, 10))
    return img


def add_stain(img):
    """Add a discolored stain defect."""
    draw = ImageDraw.Draw(img)
    cx = random.randint(30, IMG_SIZE - 30)
    cy = random.randint(30, IMG_SIZE - 30)
    r = random.randint(15, 40)
    stain_color = (
        random.randint(60, 120),
        random.randint(40, 80),
        random.randint(20, 60),
    )
    # draw multiple overlapping circles for irregular shape
    for _ in range(random.randint(3, 7)):
        ox = cx + random.randint(-r // 2, r // 2)
        oy = cy + random.randint(-r // 2, r // 2)
        sr = random.randint(r // 3, r)
        draw.ellipse([ox - sr, oy - sr, ox + sr, oy + sr], fill=stain_color)
    img = img.filter(ImageFilter.GaussianBlur(radius=1.5))
    return img


def add_scratch(img):
    """Add a linear scratch defect."""
    draw = ImageDraw.Draw(img)
    x1 = random.randint(0, IMG_SIZE)
    y1 = random.randint(0, IMG_SIZE)
    length = random.randint(60, 160)
    angle = random.uniform(0, 3.14)
    x2 = int(x1 + length * np.cos(angle))
    y2 = int(y1 + length * np.sin(angle))
    color = tuple(random.randint(20, 60) for _ in range(3))
    draw.line([(x1, y1), (x2, y2)], fill=color, width=random.randint(2, 5))
    return img


def add_missing_thread(img):
    """Add a missing-thread defect (thin light line)."""
    draw = ImageDraw.Draw(img)
    if random.random() > 0.5:
        y = random.randint(0, IMG_SIZE)
        draw.line([(0, y), (IMG_SIZE, y)], fill=(220, 210, 200), width=random.randint(2, 4))
    else:
        x = random.randint(0, IMG_SIZE)
        draw.line([(x, 0), (x, IMG_SIZE)], fill=(220, 210, 200), width=random.randint(2, 4))
    return img


def add_defects(img):
    """Apply 1-3 random defects to an image."""
    defect_fns = [add_hole, add_stain, add_scratch, add_missing_thread]
    n = random.randint(1, 3)
    for fn in random.sample(defect_fns, n):
        img = fn(img)
    return img


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    total = sum(v for split in SPLITS.values() for v in split.values())
    generated = 0

    print("=" * 50)
    print("Textile Dataset Generator")
    print("=" * 50)
    print(f"Output: {DATASET_DIR}")
    print(f"Total images: {total}\n")

    for split, classes in SPLITS.items():
        for cls, count in classes.items():
            out_dir = os.path.join(DATASET_DIR, split, cls)
            os.makedirs(out_dir, exist_ok=True)

            for i in range(count):
                img = generate_fabric()

                if cls == "defective":
                    img = add_defects(img)

                # resize to final size
                img = img.resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
                filepath = os.path.join(out_dir, f"{cls}_{i+1:04d}.png")
                img.save(filepath)
                generated += 1

            print(f"  {split}/{cls}: {count} images generated")

    print(f"\nDone! {generated} images saved to {DATASET_DIR}")


if __name__ == "__main__":
    main()
