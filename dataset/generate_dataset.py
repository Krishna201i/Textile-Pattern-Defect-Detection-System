"""
Realistic Synthetic Textile Dataset Generator.
Creates fabric textures with fiber-level detail and natural-looking defects.
"""
import os, random, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SPLITS = {
    "train": {"defective": 400, "non_defective": 400},
    "test":  {"defective": 100, "non_defective": 100},
}
IMG_SIZE = 256

# --- Perlin-style noise for organic texture ---
def _fade(t): return 6*t**5 - 15*t**4 + 10*t**3

def perlin_noise(size, scale=32, octaves=4):
    """Generate organic noise map (0-1) using multi-octave value noise."""
    result = np.zeros((size, size), dtype=np.float64)
    amp, freq = 1.0, 1.0
    for _ in range(octaves):
        grid_h = max(2, int(size / (scale / freq)))
        grid_w = grid_h
        rand_grid = np.random.rand(grid_h + 1, grid_w + 1)
        ys = np.linspace(0, grid_h - 1, size, endpoint=False)
        xs = np.linspace(0, grid_w - 1, size, endpoint=False)
        x_grid, y_grid = np.meshgrid(xs, ys)
        x0 = x_grid.astype(int); y0 = y_grid.astype(int)
        x1 = x0 + 1; y1 = y0 + 1
        sx = _fade(x_grid - x0); sy = _fade(y_grid - y0)
        n00 = rand_grid[y0, x0]; n10 = rand_grid[y0, x1]
        n01 = rand_grid[y1, x0]; n11 = rand_grid[y1, x1]
        nx0 = n00 + sx * (n10 - n00)
        nx1 = n01 + sx * (n11 - n01)
        result += amp * (nx0 + sy * (nx1 - nx0))
        amp *= 0.5; freq *= 2.0
    mn, mx = result.min(), result.max()
    return (result - mn) / (mx - mn + 1e-8)

# --- Realistic fabric colors ---
FABRIC_COLORS = [
    {"base": (215,205,190), "warp": (195,185,170), "weft": (225,215,200), "name": "linen"},
    {"base": (45,50,70),    "warp": (35,40,60),    "weft": (55,60,80),    "name": "navy"},
    {"base": (160,55,50),   "warp": (140,40,35),   "weft": (180,70,65),   "name": "crimson"},
    {"base": (70,95,65),    "warp": (55,80,50),    "weft": (85,110,80),   "name": "olive"},
    {"base": (185,180,195), "warp": (170,165,180), "weft": (200,195,210), "name": "silver"},
    {"base": (120,85,60),   "warp": (100,70,45),   "weft": (140,100,75),  "name": "chestnut"},
    {"base": (55,55,55),    "warp": (40,40,40),    "weft": (70,70,70),    "name": "charcoal"},
    {"base": (200,175,140), "warp": (180,155,120), "weft": (220,195,160), "name": "khaki"},
    {"base": (80,110,140),  "warp": (65,95,125),   "weft": (95,125,155),  "name": "denim"},
    {"base": (170,140,155), "warp": (155,125,140), "weft": (185,155,170), "name": "mauve"},
]

def _jitter(color, amount=10):
    return tuple(max(0, min(255, c + random.randint(-amount, amount))) for c in color)

# --- Fabric pattern generators ---

def gen_plain_weave(size):
    """Fine plain weave with visible thread structure."""
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    spacing = random.randint(3, 6)
    thread_w = max(1, spacing - 1)
    for y in range(0, size, spacing):
        c = _jitter(fc["warp"], 8)
        img[y:min(y+thread_w, size), :] = c
    for x in range(0, size, spacing):
        c = _jitter(fc["weft"], 8)
        for y in range(0, size, spacing * 2):
            y_end = min(y + spacing, size)
            img[y:y_end, x:min(x+thread_w, size)] = c
    # Fiber texture overlay
    noise = perlin_noise(size, scale=random.randint(16, 48))
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64) + (noise - 0.5) * 25, 0, 255)
    return img.astype(np.uint8), fc

def gen_twill_weave(size):
    """Diagonal twill weave (denim-like)."""
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    spacing = random.randint(3, 6)
    shift = random.choice([1, 2])
    for y in range(size):
        offset = (y * shift) % spacing
        for x in range(offset, size, spacing):
            w = min(max(1, spacing // 2), 2)
            img[y, x:min(x+w, size)] = _jitter(fc["warp"], 6)
    noise = perlin_noise(size, scale=random.randint(20, 40))
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64) + (noise - 0.5) * 20, 0, 255)
    return img.astype(np.uint8), fc

def gen_satin_weave(size):
    """Smooth satin weave with sheen effect."""
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    # Subtle horizontal sheen gradient
    sheen = np.sin(np.linspace(0, math.pi * random.uniform(2, 6), size))
    sheen = (sheen * 0.5 + 0.5)  # 0-1
    for y in range(size):
        factor = 0.85 + sheen[y] * 0.3
        img[y] = np.clip(img[y].astype(np.float64) * factor, 0, 255)
    # Very fine thread hints
    sp = random.randint(6, 12)
    for y in range(0, size, sp):
        img[y, :] = np.clip(img[y].astype(np.int16) - 12, 0, 255).astype(np.uint8)
    noise = perlin_noise(size, scale=random.randint(24, 64), octaves=3)
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64) + (noise - 0.5) * 15, 0, 255)
    return img.astype(np.uint8), fc

def gen_herringbone(size):
    """V-shaped herringbone weave."""
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    block = random.randint(8, 16)
    for y in range(size):
        for x in range(size):
            bx = (x // block) % 2
            diag = (x + y) if bx == 0 else (x - y)
            if diag % random.randint(3, 5) < 2:
                img[y, x] = _jitter(fc["warp"], 5)
    noise = perlin_noise(size, scale=32)
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64) + (noise - 0.5) * 18, 0, 255)
    return img.astype(np.uint8), fc

def gen_ribbed(size):
    """Vertical or horizontal ribbed texture."""
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    spacing = random.randint(3, 7)
    vertical = random.random() > 0.5
    for i in range(0, size, spacing):
        bright = 1.12 if (i // spacing) % 2 == 0 else 0.88
        if vertical:
            img[:, i:min(i+spacing,size)] = np.clip(
                img[:, i:min(i+spacing,size)].astype(np.float64) * bright, 0, 255)
        else:
            img[i:min(i+spacing,size), :] = np.clip(
                img[i:min(i+spacing,size), :].astype(np.float64) * bright, 0, 255)
    noise = perlin_noise(size, scale=24)
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64) + (noise - 0.5) * 20, 0, 255)
    return img.astype(np.uint8), fc

def generate_fabric(size=IMG_SIZE):
    gen = random.choice([gen_plain_weave, gen_twill_weave, gen_satin_weave, gen_herringbone, gen_ribbed])
    arr, fc = gen(size)
    # Micro grain noise for fiber realism
    grain = np.random.normal(0, random.uniform(3, 7), arr.shape)
    arr = np.clip(arr.astype(np.float64) + grain, 0, 255).astype(np.uint8)
    return arr, fc

# --- Realistic defect generators ---

def defect_hole(img):
    s = img.shape[0]
    cx, cy = random.randint(40, s-40), random.randint(40, s-40)
    rx, ry = random.randint(6, 22), random.randint(6, 22)
    pil = Image.fromarray(img)
    # Dark hole with shadow gradient
    hole = Image.new("RGBA", (s, s), (0,0,0,0))
    hd = ImageDraw.Draw(hole)
    for r in range(3):
        alpha = 200 - r * 50
        off = r * 2
        hd.ellipse([cx-rx-off, cy-ry-off, cx+rx+off, cy+ry+off], fill=(15,12,10, max(30, alpha)))
    hd.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=(10,8,5, 230))
    # Frayed edges
    for _ in range(random.randint(8, 20)):
        a = random.uniform(0, 2*math.pi)
        l = random.randint(3, 12)
        x1 = int(cx + rx * math.cos(a)); y1 = int(cy + ry * math.sin(a))
        x2 = int(x1 + l * math.cos(a));  y2 = int(y1 + l * math.sin(a))
        hd.line([(x1,y1),(x2,y2)], fill=(30,25,20, 180), width=1)
    hole = hole.filter(ImageFilter.GaussianBlur(1))
    result = Image.alpha_composite(pil.convert("RGBA"), hole)
    return np.array(result.convert("RGB"))

def defect_stain(img):
    s = img.shape[0]
    cx, cy = random.randint(35, s-35), random.randint(35, s-35)
    stain_type = random.choice(["oil", "water", "rust"])
    if stain_type == "oil":
        color = (random.randint(80,120), random.randint(70,100), random.randint(30,60))
    elif stain_type == "water":
        color = tuple(max(0, c - random.randint(15,35)) for c in img[cy,cx])
    else:
        color = (random.randint(140,180), random.randint(70,100), random.randint(30,50))
    overlay = Image.new("RGBA", (s, s), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    for _ in range(random.randint(4, 10)):
        ox, oy = random.randint(-15,15), random.randint(-15,15)
        r = random.randint(8, 35)
        alpha = random.randint(40, 120)
        od.ellipse([cx+ox-r, cy+oy-r, cx+ox+r, cy+oy+r], fill=(*color, alpha))
    overlay = overlay.filter(ImageFilter.GaussianBlur(random.uniform(2, 5)))
    result = Image.alpha_composite(Image.fromarray(img).convert("RGBA"), overlay)
    return np.array(result.convert("RGB"))

def defect_tear(img):
    s = img.shape[0]
    pil = Image.fromarray(img); draw = ImageDraw.Draw(pil)
    sx, sy = random.randint(20, s-20), random.randint(20, s//3)
    pts = [(sx, sy)]
    for _ in range(random.randint(6, 15)):
        last = pts[-1]
        nx = max(5, min(s-5, last[0] + random.randint(-12, 12)))
        ny = max(5, min(s-5, last[1] + random.randint(5, 18)))
        pts.append((nx, ny))
    dark = (random.randint(15,40),)*3
    draw.line(pts, fill=dark, width=random.randint(2, 4))
    # Shadow alongside tear
    for p1, p2 in zip(pts, pts[1:]):
        sp1 = (p1[0]+2, p1[1]+1); sp2 = (p2[0]+2, p2[1]+1)
        draw.line([sp1, sp2], fill=tuple(c+20 for c in dark), width=1)
    return np.array(pil)

def defect_thread_pull(img):
    s = img.shape[0]
    pil = Image.fromarray(img); draw = ImageDraw.Draw(pil)
    y0 = random.randint(20, s-20)
    x_start, x_end = random.randint(10, s//3), random.randint(s*2//3, s-10)
    base_c = tuple(int(c) for c in img[y0, s//2])
    thread_c = tuple(min(255, c + random.randint(25, 50)) for c in base_c)
    pts = []
    for x in range(x_start, x_end, 2):
        sag = int(random.randint(2, 8) * math.sin((x - x_start) / max(1, x_end - x_start) * math.pi))
        pts.append((x, y0 - sag))
    if len(pts) > 1:
        draw.line(pts, fill=thread_c, width=random.randint(1, 2))
        # Shadow below pulled thread
        shadow_pts = [(p[0], p[1]+2) for p in pts]
        draw.line(shadow_pts, fill=tuple(max(0, c-40) for c in base_c), width=1)
    return np.array(pil)

def defect_missing_thread(img):
    s = img.shape[0]
    arr = img.copy()
    if random.random() > 0.5:
        y = random.randint(10, s-10); h = random.randint(2, 5)
        arr[y:y+h, :] = np.clip(arr[y:y+h].astype(np.int16) - random.randint(25, 50), 0, 255)
    else:
        x = random.randint(10, s-10); w = random.randint(2, 5)
        arr[:, x:x+w] = np.clip(arr[:, x:x+w].astype(np.int16) - random.randint(25, 50), 0, 255)
    return arr.astype(np.uint8)

def defect_pilling(img):
    """Small fuzzy balls on fabric surface."""
    s = img.shape[0]
    pil = Image.fromarray(img); draw = ImageDraw.Draw(pil)
    cx, cy = random.randint(40, s-40), random.randint(40, s-40)
    region = random.randint(25, 60)
    for _ in range(random.randint(8, 30)):
        px = cx + random.randint(-region, region)
        py = cy + random.randint(-region, region)
        px, py = max(2, min(s-2, px)), max(2, min(s-2, py))
        r = random.randint(1, 3)
        base = tuple(int(c) for c in img[py, px])
        c = tuple(min(255, v + random.randint(15, 40)) for v in base)
        draw.ellipse([px-r, py-r, px+r, py+r], fill=c)
    return np.array(pil)

def defect_discolor(img):
    s = img.shape[0]
    cx, cy = random.randint(40, s-40), random.randint(40, s-40)
    w, h = random.randint(30, 80), random.randint(30, 80)
    x0, y0 = max(0, cx-w//2), max(0, cy-h//2)
    x1, y1 = min(s, cx+w//2), min(s, cy+h//2)
    patch = img[y0:y1, x0:x1].astype(np.float64)
    # Shift color channels independently
    for ch in range(3):
        patch[:,:,ch] *= random.uniform(0.65, 1.35)
    patch = np.clip(patch, 0, 255).astype(np.uint8)
    # Blend edges with Gaussian mask
    mask = np.zeros((y1-y0, x1-x0), dtype=np.float64)
    my, mx = mask.shape[0]//2, mask.shape[1]//2
    for yy in range(mask.shape[0]):
        for xx in range(mask.shape[1]):
            d = math.sqrt((yy-my)**2 + (xx-mx)**2) / max(my, mx, 1)
            mask[yy, xx] = max(0, 1 - d)
    mask = np.stack([mask]*3, axis=-1)
    blended = img[y0:y1, x0:x1].astype(np.float64) * (1-mask) + patch.astype(np.float64) * mask
    result = img.copy()
    result[y0:y1, x0:x1] = np.clip(blended, 0, 255).astype(np.uint8)
    return result

DEFECT_FNS = [defect_hole, defect_stain, defect_tear, defect_thread_pull,
              defect_missing_thread, defect_pilling, defect_discolor]

def add_defects(img):
    n = random.choices([1, 2, 3], weights=[50, 35, 15])[0]
    for fn in random.sample(DEFECT_FNS, min(n, len(DEFECT_FNS))):
        img = fn(img)
    return img

# --- Post-processing for realism ---

def post_process(img_array):
    """Add subtle lighting variation and vignette."""
    pil = Image.fromarray(img_array)
    # Random subtle brightness/contrast
    pil = ImageEnhance.Brightness(pil).enhance(random.uniform(0.90, 1.10))
    pil = ImageEnhance.Contrast(pil).enhance(random.uniform(0.92, 1.08))
    # Subtle vignette
    arr = np.array(pil, dtype=np.float64)
    s = arr.shape[0]
    Y, X = np.ogrid[:s, :s]
    center = s / 2
    dist = np.sqrt((X - center)**2 + (Y - center)**2) / (center * 1.4)
    vignette = 1 - dist * random.uniform(0.05, 0.15)
    for ch in range(3):
        arr[:,:,ch] *= vignette
    return np.clip(arr, 0, 255).astype(np.uint8)

# --- Main ---

def main():
    total = sum(v for sp in SPLITS.values() for v in sp.values())
    gen_count = 0
    print("=" * 55)
    print("  Realistic Textile Dataset Generator")
    print("=" * 55)
    print(f"  Output : {BASE_DIR}")
    print(f"  Images : {total}  |  Size : {IMG_SIZE}x{IMG_SIZE}\n")

    for split, classes in SPLITS.items():
        for cls, count in classes.items():
            out_dir = os.path.join(BASE_DIR, split, cls)
            os.makedirs(out_dir, exist_ok=True)
            for i in range(count):
                arr, _ = generate_fabric(IMG_SIZE)
                if cls == "defective":
                    arr = add_defects(arr)
                arr = post_process(arr)
                img = Image.fromarray(arr).resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
                img.save(os.path.join(out_dir, f"{cls}_{i+1:04d}.png"))
                gen_count += 1
                if (i+1) % 100 == 0:
                    print(f"    {split}/{cls}: {i+1}/{count}")
            print(f"  ✓ {split}/{cls}: {count} images done")

    print(f"\n  Done! {gen_count} realistic images generated.")
    print("=" * 55)

if __name__ == "__main__":
    main()
