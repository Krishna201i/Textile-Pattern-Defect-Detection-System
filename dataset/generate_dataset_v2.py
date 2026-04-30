"""
Enhanced Synthetic Textile Dataset Generator v2.
Creates diverse fabric textures including patterned fabrics, with realistic defects.
Generates 1000 train + 250 test images per class for robust model training.
"""
import os, random, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Default: reduced counts safe for local machines (avoids OOM before TF loads)
# Use --full flag (or set TEXTILE_FULL_DATASET=1 env var) for the original 2500-image dataset.
import sys as _sys
_FULL = '--full' in _sys.argv or os.environ.get('TEXTILE_FULL_DATASET', '') == '1'

SPLITS = {
    "train": {"defective": 1000 if _FULL else 400, "non_defective": 1000 if _FULL else 400},
    "test":  {"defective":  250 if _FULL else 100, "non_defective":  250 if _FULL else 100},
}
IMG_SIZE = 224  # Match model input size directly (was 256, resized anyway)

# ---------- Perlin noise ----------
def _fade(t): return 6*t**5 - 15*t**4 + 10*t**3

def perlin_noise(size, scale=32, octaves=4):
    result = np.zeros((size, size), dtype=np.float64)
    amp, freq = 1.0, 1.0
    for _ in range(octaves):
        gh = max(2, int(size / (scale / freq)))
        rg = np.random.rand(gh+1, gh+1)
        ys = np.linspace(0, gh-1, size, endpoint=False)
        xs = np.linspace(0, gh-1, size, endpoint=False)
        xg, yg = np.meshgrid(xs, ys)
        x0 = xg.astype(int); y0 = yg.astype(int)
        x1 = x0+1; y1 = y0+1
        sx = _fade(xg-x0); sy = _fade(yg-y0)
        n00 = rg[y0,x0]; n10 = rg[y0,x1]
        n01 = rg[y1,x0]; n11 = rg[y1,x1]
        nx0 = n00+sx*(n10-n00); nx1 = n01+sx*(n11-n01)
        result += amp*(nx0+sy*(nx1-nx0))
        amp *= 0.5; freq *= 2.0
    mn, mx = result.min(), result.max()
    return (result-mn)/(mx-mn+1e-8)

# ---------- Fabric colors ----------
FABRIC_COLORS = [
    {"base":(215,205,190),"warp":(195,185,170),"weft":(225,215,200),"name":"linen"},
    {"base":(45,50,70),   "warp":(35,40,60),   "weft":(55,60,80),   "name":"navy"},
    {"base":(160,55,50),  "warp":(140,40,35),  "weft":(180,70,65),  "name":"crimson"},
    {"base":(70,95,65),   "warp":(55,80,50),   "weft":(85,110,80),  "name":"olive"},
    {"base":(185,180,195),"warp":(170,165,180),"weft":(200,195,210),"name":"silver"},
    {"base":(120,85,60),  "warp":(100,70,45),  "weft":(140,100,75), "name":"chestnut"},
    {"base":(55,55,55),   "warp":(40,40,40),   "weft":(70,70,70),   "name":"charcoal"},
    {"base":(200,175,140),"warp":(180,155,120),"weft":(220,195,160),"name":"khaki"},
    {"base":(80,110,140), "warp":(65,95,125),  "weft":(95,125,155), "name":"denim"},
    {"base":(170,140,155),"warp":(155,125,140),"weft":(185,155,170),"name":"mauve"},
    {"base":(230,220,200),"warp":(210,200,180),"weft":(240,230,210),"name":"cream"},
    {"base":(90,70,100),  "warp":(75,55,85),   "weft":(105,85,115), "name":"plum"},
]

def _jitter(color, amount=10):
    return tuple(max(0, min(255, c + random.randint(-amount, amount))) for c in color)

# ---------- Fabric pattern generators (original 5 + 4 new) ----------

def gen_plain_weave(size):
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    spacing = random.randint(3, 6)
    tw = max(1, spacing-1)
    for y in range(0, size, spacing):
        img[y:min(y+tw, size), :] = _jitter(fc["warp"], 8)
    for x in range(0, size, spacing):
        c = _jitter(fc["weft"], 8)
        for y in range(0, size, spacing*2):
            img[y:min(y+spacing, size), x:min(x+tw, size)] = c
    n = perlin_noise(size, random.randint(16, 48))
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*25, 0, 255)
    return img.astype(np.uint8), fc

def gen_twill_weave(size):
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    spacing = random.randint(3, 6)
    shift = random.choice([1, 2])
    for y in range(size):
        off = (y*shift) % spacing
        for x in range(off, size, spacing):
            w = min(max(1, spacing//2), 2)
            img[y, x:min(x+w, size)] = _jitter(fc["warp"], 6)
    n = perlin_noise(size, random.randint(20, 40))
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*20, 0, 255)
    return img.astype(np.uint8), fc

def gen_satin_weave(size):
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    sheen = np.sin(np.linspace(0, math.pi*random.uniform(2, 6), size))
    sheen = sheen*0.5+0.5
    for y in range(size):
        f = 0.85+sheen[y]*0.3
        img[y] = np.clip(img[y].astype(np.float64)*f, 0, 255)
    sp = random.randint(6, 12)
    for y in range(0, size, sp):
        img[y, :] = np.clip(img[y].astype(np.int16)-12, 0, 255).astype(np.uint8)
    n = perlin_noise(size, random.randint(24, 64), 3)
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*15, 0, 255)
    return img.astype(np.uint8), fc

def gen_herringbone(size):
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    block = random.randint(8, 16)
    for y in range(size):
        for x in range(size):
            bx = (x//block) % 2
            diag = (x+y) if bx == 0 else (x-y)
            if diag % random.randint(3, 5) < 2:
                img[y, x] = _jitter(fc["warp"], 5)
    n = perlin_noise(size, 32)
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*18, 0, 255)
    return img.astype(np.uint8), fc

def gen_ribbed(size):
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    spacing = random.randint(3, 7)
    vert = random.random() > 0.5
    for i in range(0, size, spacing):
        br = 1.12 if (i//spacing) % 2 == 0 else 0.88
        if vert:
            img[:, i:min(i+spacing, size)] = np.clip(
                img[:, i:min(i+spacing, size)].astype(np.float64)*br, 0, 255)
        else:
            img[i:min(i+spacing, size), :] = np.clip(
                img[i:min(i+spacing, size), :].astype(np.float64)*br, 0, 255)
    n = perlin_noise(size, 24)
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*20, 0, 255)
    return img.astype(np.uint8), fc

# ---- NEW: Patterned fabric generators ----

def gen_striped(size):
    """Colored stripe patterns (horizontal or vertical)."""
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    n_stripes = random.randint(4, 12)
    stripe_w = size // n_stripes
    vert = random.random() > 0.5
    for i in range(n_stripes):
        if i % 2 == 0:
            c = _jitter(fc["warp"], 25)
        else:
            c = _jitter(fc["weft"], 25)
        s = i * stripe_w
        e = min(s + stripe_w, size)
        if vert:
            img[:, s:e] = c
        else:
            img[s:e, :] = c
    n = perlin_noise(size, random.randint(16, 40))
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*15, 0, 255)
    return img.astype(np.uint8), fc

def gen_plaid(size):
    """Plaid / tartan pattern with overlapping stripes."""
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    n_stripes = random.randint(3, 8)
    stripe_w = size // n_stripes
    # Horizontal stripes
    for i in range(n_stripes):
        if i % 2 == 0:
            c = np.array(_jitter(fc["warp"], 30), dtype=np.float64)
        else:
            c = np.array(fc["base"], dtype=np.float64)
        s = i * stripe_w; e = min(s+stripe_w, size)
        img[s:e, :] = np.clip(img[s:e, :].astype(np.float64)*0.5 + c*0.5, 0, 255).astype(np.uint8)
    # Vertical stripes (overlay with alpha blend)
    for i in range(n_stripes):
        if i % 2 == 1:
            c = np.array(_jitter(fc["weft"], 30), dtype=np.float64)
        else:
            c = np.array(fc["base"], dtype=np.float64)
        s = i * stripe_w; e = min(s+stripe_w, size)
        img[:, s:e] = np.clip(img[:, s:e].astype(np.float64)*0.6 + c*0.4, 0, 255).astype(np.uint8)
    n = perlin_noise(size, random.randint(20, 48))
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*12, 0, 255)
    return img.astype(np.uint8), fc

def gen_dotted(size):
    """Polka dot or small repeating circle pattern."""
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    pil = Image.fromarray(img)
    draw = ImageDraw.Draw(pil)
    spacing = random.randint(12, 30)
    dot_r = random.randint(2, max(3, spacing//4))
    dot_color = _jitter(fc["warp"], 40)
    for y in range(spacing//2, size, spacing):
        offset = (spacing//2) if ((y // spacing) % 2 == 1) else 0
        for x in range(spacing//2 + offset, size, spacing):
            draw.ellipse([x-dot_r, y-dot_r, x+dot_r, y+dot_r], fill=dot_color)
    img = np.array(pil)
    n = perlin_noise(size, random.randint(24, 48))
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*10, 0, 255)
    return img.astype(np.uint8), fc

def gen_checkered(size):
    """Checkerboard / gingham pattern."""
    fc = random.choice(FABRIC_COLORS)
    img = np.full((size, size, 3), fc["base"], dtype=np.uint8)
    block = random.randint(10, 32)
    alt_color = _jitter(fc["warp"], 35)
    for y in range(0, size, block):
        for x in range(0, size, block):
            if ((y//block) + (x//block)) % 2 == 0:
                ye = min(y+block, size); xe = min(x+block, size)
                img[y:ye, x:xe] = alt_color
    n = perlin_noise(size, random.randint(20, 40))
    for ch in range(3):
        img[:,:,ch] = np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*15, 0, 255)
    return img.astype(np.uint8), fc

ALL_GENERATORS = [
    gen_plain_weave, gen_twill_weave, gen_satin_weave, gen_herringbone,
    gen_ribbed, gen_striped, gen_plaid, gen_dotted, gen_checkered,
]

def generate_fabric(size=IMG_SIZE):
    gen = random.choice(ALL_GENERATORS)
    arr, fc = gen(size)
    grain = np.random.normal(0, random.uniform(3, 7), arr.shape)
    arr = np.clip(arr.astype(np.float64)+grain, 0, 255).astype(np.uint8)
    return arr, fc

# ---------- Defect generators (original 7 + 3 new) ----------

def defect_hole(img):
    s = img.shape[0]
    cx, cy = random.randint(40, s-40), random.randint(40, s-40)
    rx, ry = random.randint(6, 22), random.randint(6, 22)
    pil = Image.fromarray(img)
    hole = Image.new("RGBA", (s, s), (0,0,0,0))
    hd = ImageDraw.Draw(hole)
    for r in range(3):
        alpha = 200-r*50; off = r*2
        hd.ellipse([cx-rx-off, cy-ry-off, cx+rx+off, cy+ry+off], fill=(15,12,10, max(30, alpha)))
    hd.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=(10,8,5, 230))
    for _ in range(random.randint(8, 20)):
        a = random.uniform(0, 2*math.pi); l = random.randint(3, 12)
        x1 = int(cx+rx*math.cos(a)); y1 = int(cy+ry*math.sin(a))
        x2 = int(x1+l*math.cos(a)); y2 = int(y1+l*math.sin(a))
        hd.line([(x1,y1),(x2,y2)], fill=(30,25,20,180), width=1)
    hole = hole.filter(ImageFilter.GaussianBlur(1))
    result = Image.alpha_composite(pil.convert("RGBA"), hole)
    return np.array(result.convert("RGB"))

def defect_stain(img):
    s = img.shape[0]
    cx, cy = random.randint(35, s-35), random.randint(35, s-35)
    stype = random.choice(["oil","water","rust"])
    if stype == "oil":
        color = (random.randint(80,120), random.randint(70,100), random.randint(30,60))
    elif stype == "water":
        color = tuple(max(0, int(c)-random.randint(15,35)) for c in img[cy,cx])
    else:
        color = (random.randint(140,180), random.randint(70,100), random.randint(30,50))
    overlay = Image.new("RGBA", (s,s), (0,0,0,0))
    od = ImageDraw.Draw(overlay)
    for _ in range(random.randint(4, 10)):
        ox, oy = random.randint(-15,15), random.randint(-15,15)
        r = random.randint(8, 35); alpha = random.randint(40, 120)
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
        nx = max(5, min(s-5, last[0]+random.randint(-12, 12)))
        ny = max(5, min(s-5, last[1]+random.randint(5, 18)))
        pts.append((nx, ny))
    dark = (random.randint(15,40),)*3
    draw.line(pts, fill=dark, width=random.randint(2, 4))
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
    thread_c = tuple(min(255, c+random.randint(25, 50)) for c in base_c)
    pts = []
    for x in range(x_start, x_end, 2):
        sag = int(random.randint(2, 8)*math.sin((x-x_start)/max(1, x_end-x_start)*math.pi))
        pts.append((x, y0-sag))
    if len(pts) > 1:
        draw.line(pts, fill=thread_c, width=random.randint(1, 2))
        shadow_pts = [(p[0], p[1]+2) for p in pts]
        draw.line(shadow_pts, fill=tuple(max(0, c-40) for c in base_c), width=1)
    return np.array(pil)

def defect_missing_thread(img):
    s = img.shape[0]; arr = img.copy()
    if random.random() > 0.5:
        y = random.randint(10, s-10); h = random.randint(2, 5)
        arr[y:y+h, :] = np.clip(arr[y:y+h].astype(np.int16)-random.randint(25, 50), 0, 255)
    else:
        x = random.randint(10, s-10); w = random.randint(2, 5)
        arr[:, x:x+w] = np.clip(arr[:, x:x+w].astype(np.int16)-random.randint(25, 50), 0, 255)
    return arr.astype(np.uint8)

def defect_pilling(img):
    s = img.shape[0]
    pil = Image.fromarray(img); draw = ImageDraw.Draw(pil)
    cx, cy = random.randint(40, s-40), random.randint(40, s-40)
    region = random.randint(25, 60)
    for _ in range(random.randint(8, 30)):
        px = max(2, min(s-2, cx+random.randint(-region, region)))
        py = max(2, min(s-2, cy+random.randint(-region, region)))
        r = random.randint(1, 3)
        base = tuple(int(c) for c in img[py, px])
        c = tuple(min(255, v+random.randint(15, 40)) for v in base)
        draw.ellipse([px-r, py-r, px+r, py+r], fill=c)
    return np.array(pil)

def defect_discolor(img):
    s = img.shape[0]
    cx, cy = random.randint(40, s-40), random.randint(40, s-40)
    w, h = random.randint(30, 80), random.randint(30, 80)
    x0, y0 = max(0, cx-w//2), max(0, cy-h//2)
    x1, y1 = min(s, cx+w//2), min(s, cy+h//2)
    patch = img[y0:y1, x0:x1].astype(np.float64)
    for ch in range(3):
        patch[:,:,ch] *= random.uniform(0.65, 1.35)
    patch = np.clip(patch, 0, 255).astype(np.uint8)
    mask = np.zeros((y1-y0, x1-x0), dtype=np.float64)
    my, mx = mask.shape[0]//2, mask.shape[1]//2
    for yy in range(mask.shape[0]):
        for xx in range(mask.shape[1]):
            d = math.sqrt((yy-my)**2+(xx-mx)**2)/max(my, mx, 1)
            mask[yy, xx] = max(0, 1-d)
    mask = np.stack([mask]*3, axis=-1)
    blended = img[y0:y1, x0:x1].astype(np.float64)*(1-mask)+patch.astype(np.float64)*mask
    result = img.copy()
    result[y0:y1, x0:x1] = np.clip(blended, 0, 255).astype(np.uint8)
    return result

# ---- NEW defect types ----

def defect_crease(img):
    """A fold/crease line across the fabric."""
    s = img.shape[0]; arr = img.copy().astype(np.float64)
    horizontal = random.random() > 0.5
    pos = random.randint(s//4, 3*s//4)
    width = random.randint(3, 8)
    darken = random.uniform(0.7, 0.85)
    lighten = random.uniform(1.1, 1.25)
    if horizontal:
        arr[max(0,pos-width):pos, :] *= darken
        arr[pos:min(s,pos+width), :] *= lighten
    else:
        arr[:, max(0,pos-width):pos] *= darken
        arr[:, pos:min(s,pos+width)] *= lighten
    return np.clip(arr, 0, 255).astype(np.uint8)

def defect_knot(img):
    """A small raised knot in the weave."""
    s = img.shape[0]
    pil = Image.fromarray(img); draw = ImageDraw.Draw(pil)
    cx, cy = random.randint(30, s-30), random.randint(30, s-30)
    r = random.randint(3, 8)
    base = tuple(int(c) for c in img[cy, cx])
    bright = tuple(min(255, c+random.randint(30, 60)) for c in base)
    dark = tuple(max(0, c-random.randint(20, 40)) for c in base)
    # Shadow
    draw.ellipse([cx-r+1, cy-r+1, cx+r+1, cy+r+1], fill=dark)
    # Highlight
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=bright)
    return np.array(pil)

def defect_color_bleed(img):
    """Color bleeding from one region into adjacent areas."""
    s = img.shape[0]; arr = img.copy()
    cx, cy = random.randint(40, s-40), random.randint(40, s-40)
    bleed_color = np.array([random.randint(100, 220), random.randint(50, 180), random.randint(50, 160)], dtype=np.float64)
    radius = random.randint(20, 50)
    Y, X = np.ogrid[:s, :s]
    dist = np.sqrt((X-cx)**2 + (Y-cy)**2)
    mask = np.clip(1.0 - dist/radius, 0, 1)
    alpha = random.uniform(0.15, 0.4)
    for ch in range(3):
        arr[:,:,ch] = np.clip(arr[:,:,ch].astype(np.float64)*(1-mask*alpha) + bleed_color[ch]*mask*alpha, 0, 255)
    return arr.astype(np.uint8)

DEFECT_FNS = [
    defect_hole, defect_stain, defect_tear, defect_thread_pull,
    defect_missing_thread, defect_pilling, defect_discolor,
    defect_crease, defect_knot, defect_color_bleed,
]

def add_defects(img):
    n = random.choices([1, 2, 3], weights=[50, 35, 15])[0]
    for fn in random.sample(DEFECT_FNS, min(n, len(DEFECT_FNS))):
        img = fn(img)
    return img

# ---------- Post-processing ----------

def post_process(img_array):
    pil = Image.fromarray(img_array)
    pil = ImageEnhance.Brightness(pil).enhance(random.uniform(0.88, 1.12))
    pil = ImageEnhance.Contrast(pil).enhance(random.uniform(0.90, 1.10))
    # Random white balance shift
    arr = np.array(pil, dtype=np.float64)
    for ch in range(3):
        arr[:,:,ch] *= random.uniform(0.95, 1.05)
    # Vignette
    s = arr.shape[0]
    Y, X = np.ogrid[:s, :s]
    center = s / 2
    dist = np.sqrt((X-center)**2 + (Y-center)**2) / (center*1.4)
    vignette = 1 - dist*random.uniform(0.05, 0.18)
    for ch in range(3):
        arr[:,:,ch] *= vignette
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    # Random JPEG compression artifacts for realism
    if random.random() < 0.3:
        import io
        pil2 = Image.fromarray(arr)
        buf = io.BytesIO()
        pil2.save(buf, format="JPEG", quality=random.randint(60, 85))
        buf.seek(0)
        arr = np.array(Image.open(buf))
    return arr

# ---------- Main ----------

def main():
    total = sum(v for sp in SPLITS.values() for v in sp.values())
    gen_count = 0
    print("=" * 55)
    print("  Enhanced Textile Dataset Generator v2")
    print("=" * 55)
    print(f"  Output : {BASE_DIR}")
    print(f"  Images : {total}  |  Size : {IMG_SIZE}x{IMG_SIZE}")
    print(f"  Patterns: {len(ALL_GENERATORS)} weave types")
    print(f"  Defects : {len(DEFECT_FNS)} defect types\n")

    for split, classes in SPLITS.items():
        for cls, count in classes.items():
            out_dir = os.path.join(BASE_DIR, split, cls)
            os.makedirs(out_dir, exist_ok=True)
            # Clear old v2 files
            for fn in os.listdir(out_dir):
                if fn.startswith("v2_"):
                    try: os.remove(os.path.join(out_dir, fn))
                    except: pass

            for i in range(count):
                arr, _ = generate_fabric(IMG_SIZE)
                if cls == "defective":
                    arr = add_defects(arr)
                arr = post_process(arr)
                img = Image.fromarray(arr)
                img.save(os.path.join(out_dir, f"v2_{cls}_{i+1:04d}.png"))
                gen_count += 1
                if (i+1) % 200 == 0:
                    print(f"    {split}/{cls}: {i+1}/{count}")
            print(f"  [OK] {split}/{cls}: {count} images done")

    print(f"\n  Done! {gen_count} images generated.")
    print("=" * 55)

if __name__ == "__main__":
    main()
