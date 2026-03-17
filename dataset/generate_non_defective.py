"""
Generate realistic NON-DEFECTIVE fabric images to complement the real
defective images downloaded from Kaggle.
Produces clean, high-quality fabric textures without any defects.
"""
import os, random, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

random.seed(123)
np.random.seed(123)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAIN_NONDEF = os.path.join(BASE_DIR, "train", "non_defective")
TEST_NONDEF = os.path.join(BASE_DIR, "test", "non_defective")
IMG_SIZE = 256

# Count existing defective images to match
train_def_count = len([f for f in os.listdir(os.path.join(BASE_DIR, "train", "defective"))
                       if f.lower().endswith(('.jpg','.jpeg','.png'))])
test_def_count = len([f for f in os.listdir(os.path.join(BASE_DIR, "test", "defective"))
                      if f.lower().endswith(('.jpg','.jpeg','.png'))])

FABRIC_COLORS = [
    {"base":(215,205,190),"warp":(195,185,170),"weft":(225,215,200)},
    {"base":(45,50,70),"warp":(35,40,60),"weft":(55,60,80)},
    {"base":(160,55,50),"warp":(140,40,35),"weft":(180,70,65)},
    {"base":(70,95,65),"warp":(55,80,50),"weft":(85,110,80)},
    {"base":(185,180,195),"warp":(170,165,180),"weft":(200,195,210)},
    {"base":(120,85,60),"warp":(100,70,45),"weft":(140,100,75)},
    {"base":(55,55,55),"warp":(40,40,40),"weft":(70,70,70)},
    {"base":(200,175,140),"warp":(180,155,120),"weft":(220,195,160)},
    {"base":(80,110,140),"warp":(65,95,125),"weft":(95,125,155)},
    {"base":(170,140,155),"warp":(155,125,140),"weft":(185,155,170)},
]

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
        x0=xg.astype(int); y0=yg.astype(int); x1=x0+1; y1=y0+1
        sx=_fade(xg-x0); sy=_fade(yg-y0)
        n00=rg[y0,x0]; n10=rg[y0,x1]; n01=rg[y1,x0]; n11=rg[y1,x1]
        nx0=n00+sx*(n10-n00); nx1=n01+sx*(n11-n01)
        result += amp*(nx0+sy*(nx1-nx0))
        amp*=0.5; freq*=2.0
    mn,mx = result.min(), result.max()
    return (result-mn)/(mx-mn+1e-8)

def jit(c, a=10):
    return tuple(max(0,min(255,v+random.randint(-a,a))) for v in c)

def gen_plain(s):
    fc=random.choice(FABRIC_COLORS); img=np.full((s,s,3),fc["base"],dtype=np.uint8)
    sp=random.randint(3,6); tw=max(1,sp-1)
    for y in range(0,s,sp): img[y:min(y+tw,s),:]=jit(fc["warp"],8)
    for x in range(0,s,sp):
        c=jit(fc["weft"],8)
        for y in range(0,s,sp*2): img[y:min(y+sp,s),x:min(x+tw,s)]=c
    n=perlin_noise(s,random.randint(16,48))
    for ch in range(3): img[:,:,ch]=np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*25,0,255)
    return img.astype(np.uint8)

def gen_twill(s):
    fc=random.choice(FABRIC_COLORS); img=np.full((s,s,3),fc["base"],dtype=np.uint8)
    sp=random.randint(3,6); sh=random.choice([1,2])
    for y in range(s):
        off=(y*sh)%sp
        for x in range(off,s,sp):
            w=min(max(1,sp//2),2); img[y,x:min(x+w,s)]=jit(fc["warp"],6)
    n=perlin_noise(s,random.randint(20,40))
    for ch in range(3): img[:,:,ch]=np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*20,0,255)
    return img.astype(np.uint8)

def gen_satin(s):
    fc=random.choice(FABRIC_COLORS); img=np.full((s,s,3),fc["base"],dtype=np.uint8)
    sheen=np.sin(np.linspace(0,math.pi*random.uniform(2,6),s))
    sheen=sheen*0.5+0.5
    for y in range(s):
        f=0.85+sheen[y]*0.3; img[y]=np.clip(img[y].astype(np.float64)*f,0,255)
    sp=random.randint(6,12)
    for y in range(0,s,sp): img[y,:]=np.clip(img[y].astype(np.int16)-12,0,255).astype(np.uint8)
    n=perlin_noise(s,random.randint(24,64),3)
    for ch in range(3): img[:,:,ch]=np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*15,0,255)
    return img.astype(np.uint8)

def gen_herring(s):
    fc=random.choice(FABRIC_COLORS); img=np.full((s,s,3),fc["base"],dtype=np.uint8)
    blk=random.randint(8,16)
    for y in range(s):
        for x in range(s):
            bx=(x//blk)%2; d=(x+y) if bx==0 else (x-y)
            if d%random.randint(3,5)<2: img[y,x]=jit(fc["warp"],5)
    n=perlin_noise(s,32)
    for ch in range(3): img[:,:,ch]=np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*18,0,255)
    return img.astype(np.uint8)

def gen_ribbed(s):
    fc=random.choice(FABRIC_COLORS); img=np.full((s,s,3),fc["base"],dtype=np.uint8)
    sp=random.randint(3,7); vert=random.random()>0.5
    for i in range(0,s,sp):
        br=1.12 if(i//sp)%2==0 else 0.88
        if vert: img[:,i:min(i+sp,s)]=np.clip(img[:,i:min(i+sp,s)].astype(np.float64)*br,0,255)
        else: img[i:min(i+sp,s),:]=np.clip(img[i:min(i+sp,s),:].astype(np.float64)*br,0,255)
    n=perlin_noise(s,24)
    for ch in range(3): img[:,:,ch]=np.clip(img[:,:,ch].astype(np.float64)+(n-0.5)*20,0,255)
    return img.astype(np.uint8)

def generate_clean(s=IMG_SIZE):
    gen=random.choice([gen_plain,gen_twill,gen_satin,gen_herring,gen_ribbed])
    arr=gen(s)
    grain=np.random.normal(0,random.uniform(3,7),arr.shape)
    arr=np.clip(arr.astype(np.float64)+grain,0,255).astype(np.uint8)
    pil=Image.fromarray(arr)
    pil=ImageEnhance.Brightness(pil).enhance(random.uniform(0.9,1.1))
    pil=ImageEnhance.Contrast(pil).enhance(random.uniform(0.92,1.08))
    # Vignette
    a=np.array(pil,dtype=np.float64)
    Y,X=np.ogrid[:s,:s]; c=s/2
    d=np.sqrt((X-c)**2+(Y-c)**2)/(c*1.4)
    v=1-d*random.uniform(0.05,0.15)
    for ch in range(3): a[:,:,ch]*=v
    return np.clip(a,0,255).astype(np.uint8)

def gen_batch(out_dir, count, prefix="non_defective"):
    os.makedirs(out_dir, exist_ok=True)
    for i in range(count):
        arr=generate_clean(IMG_SIZE)
        Image.fromarray(arr).save(os.path.join(out_dir, f"{prefix}_{i+1:04d}.png"))
        if (i+1)%100==0: print(f"    {i+1}/{count}")
    print(f"  ✓ {count} images saved to {out_dir}")

def main():
    print("="*55)
    print("  Non-Defective Fabric Image Generator")
    print("="*55)
    print(f"\n  Matching defective counts:")
    print(f"    Train defective: {train_def_count} -> generating {train_def_count} non-defective")
    print(f"    Test defective:  {test_def_count} -> generating {test_def_count} non-defective\n")

    print("  Generating train/non_defective...")
    gen_batch(TRAIN_NONDEF, train_def_count)
    print("  Generating test/non_defective...")
    gen_batch(TEST_NONDEF, test_def_count)

    print(f"\n  Done! Dataset is now balanced.")
    print("="*55)

if __name__ == "__main__":
    main()
