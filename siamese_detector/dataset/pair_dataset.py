"""
Custom Dataset for Siamese Network training.

Expected folder layout:
    data/
        defective/      ← images with defects
        non_defective/  ← reference / perfect images

Pairs generated:
    label=0  →  similar pair   (non_defective vs non_defective)
    label=1  →  dissimilar pair (non_defective vs defective)
"""

import random
from pathlib import Path
from typing import Optional

import torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff"}


class TextilePairDataset(Dataset):
    """Generates balanced (50/50) similar and dissimilar image pairs."""

    def __init__(
        self,
        root_dir: str,
        transform: Optional[transforms.Compose] = None,
        pairs_per_epoch: int = 1000,
        seed: int = 42,
    ):
        self.root_dir = Path(root_dir)
        self.transform = transform

        random.seed(seed)

        # Gather all image paths per class
        self.defective     = self._collect("defective")
        self.non_defective = self._collect("non_defective")

        if not self.non_defective:
            raise ValueError(f"No non-defective images found under {root_dir}/non_defective/")

        print(f"[Dataset] defective={len(self.defective)}  non_defective={len(self.non_defective)}")

        self.pairs = self._build_pairs(pairs_per_epoch)

    # ── helpers ───────────────────────────────────────────────────────────────

    def _collect(self, subfolder: str) -> list:
        folder = self.root_dir / subfolder
        if not folder.exists():
            return []
        return sorted(p for p in folder.rglob("*") if p.suffix.lower() in IMAGE_EXTS)

    def _build_pairs(self, n: int) -> list:
        """Build n/2 positive + n/2 negative pairs."""
        pairs = []
        half  = n // 2

        # Positive pairs: non_defective vs non_defective  (label=0)
        for _ in range(half):
            if len(self.non_defective) >= 2:
                a, b = random.sample(self.non_defective, 2)
            else:
                a = b = self.non_defective[0]
            pairs.append((a, b, 0))

        # Negative pairs: non_defective vs defective  (label=1)
        for _ in range(n - half):
            a = random.choice(self.non_defective)
            b = random.choice(self.defective) if self.defective else random.choice(self.non_defective)
            pairs.append((a, b, 1))

        random.shuffle(pairs)
        return pairs

    # ── Dataset API ───────────────────────────────────────────────────────────

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int):
        p1, p2, label = self.pairs[idx]
        img1 = Image.open(p1).convert("RGB")
        img2 = Image.open(p2).convert("RGB")

        if self.transform:
            img1 = self.transform(img1)
            img2 = self.transform(img2)

        return img1, img2, torch.tensor(label, dtype=torch.float32)
