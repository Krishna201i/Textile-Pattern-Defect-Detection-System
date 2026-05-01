"""
Training script for the Siamese Network.

Usage:
    cd siamese_detector
    python train.py --data_dir ../dataset --epochs 20 --batch_size 16

Outputs:
    checkpoints/siamese_best.pt   ← best model by validation loss
    checkpoints/siamese_last.pt   ← final epoch weights
"""

import argparse
import logging
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from dataset.pair_dataset import TextilePairDataset
from models.siamese_model import SiameseNetwork, euclidean_distance
from utils.preprocess import get_transforms

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ── Contrastive Loss ──────────────────────────────────────────────────────────

class ContrastiveLoss(nn.Module):
    """
    Contrastive Loss (Hadsell et al., 2006).

    For SIMILAR pairs   (label=0): minimize distance → pull embeddings together.
    For DISSIMILAR pairs (label=1): maximize distance (up to margin) → push apart.

    L = (1-y)*0.5*D² + y*0.5*max(0, margin - D)²
    """

    def __init__(self, margin: float = 1.0):
        super().__init__()
        self.margin = margin

    def forward(self, emb1, emb2, label):
        d = euclidean_distance(emb1, emb2)
        similar_loss    = (1 - label) * 0.5 * d ** 2
        dissimilar_loss = label * 0.5 * torch.clamp(self.margin - d, min=0) ** 2
        return (similar_loss + dissimilar_loss).mean()


# ── Train / Eval loops ────────────────────────────────────────────────────────

def train_epoch(model, loader, optimizer, criterion, device, epoch):
    model.train()
    total = 0.0
    for i, (img1, img2, labels) in enumerate(loader, 1):
        img1, img2, labels = img1.to(device), img2.to(device), labels.to(device)
        optimizer.zero_grad()
        e1, e2 = model(img1, img2)
        loss   = criterion(e1, e2, labels)
        loss.backward()
        optimizer.step()
        total += loss.item()
        if i % 20 == 0:
            log.info(f"Epoch {epoch}  batch {i}/{len(loader)}  loss={loss.item():.4f}")
    return total / len(loader)


@torch.no_grad()
def eval_epoch(model, loader, criterion, device, threshold):
    model.eval()
    total_loss, correct, n = 0.0, 0, 0
    for img1, img2, labels in loader:
        img1, img2, labels = img1.to(device), img2.to(device), labels.to(device)
        e1, e2   = model(img1, img2)
        loss     = criterion(e1, e2, labels)
        total_loss += loss.item()
        preds    = (euclidean_distance(e1, e2) > threshold).float()
        correct += (preds == labels).sum().item()
        n       += labels.size(0)
    return total_loss / len(loader), correct / n


# ── Main ─────────────────────────────────────────────────────────────────────

def main(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log.info(f"Device: {device}")

    # Dataset -----------------------------------------------------------------
    dataset = TextilePairDataset(
        root_dir        = args.data_dir,
        transform       = get_transforms("train"),
        pairs_per_epoch = args.pairs,
        seed            = 42,
    )
    val_n    = max(1, int(0.2 * len(dataset)))
    train_n  = len(dataset) - val_n
    train_ds, val_ds = random_split(dataset, [train_n, val_n])
    val_ds.dataset.transform = get_transforms("val")

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size, shuffle=False, num_workers=0)

    # Model -------------------------------------------------------------------
    model     = SiameseNetwork(embedding_dim=128, pretrained=True).to(device)
    criterion = ContrastiveLoss(margin=args.margin)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.5)

    ckpt_dir = Path("checkpoints")
    ckpt_dir.mkdir(exist_ok=True)

    best_val_loss = float("inf")

    # Training loop -----------------------------------------------------------
    for epoch in range(1, args.epochs + 1):
        train_loss = train_epoch(model, train_loader, optimizer, criterion, device, epoch)
        val_loss, val_acc = eval_epoch(model, val_loader, criterion, device, args.threshold)
        scheduler.step()

        log.info(
            f"── Epoch {epoch:03d}/{args.epochs}  "
            f"train_loss={train_loss:.4f}  "
            f"val_loss={val_loss:.4f}  "
            f"val_acc={val_acc:.2%}"
        )

        # Save best checkpoint
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), ckpt_dir / "siamese_best.pt")
            log.info(f"   ✓ Best model saved (val_loss={val_loss:.4f})")

    # Save final weights
    torch.save(model.state_dict(), ckpt_dir / "siamese_last.pt")
    log.info("Training complete. Weights saved to checkpoints/")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Train Siamese Network for textile defect detection")
    p.add_argument("--data_dir",   default="../dataset",  help="Root dir with defective/ and non_defective/")
    p.add_argument("--epochs",     type=int,   default=20)
    p.add_argument("--batch_size", type=int,   default=16)
    p.add_argument("--lr",         type=float, default=1e-3)
    p.add_argument("--margin",     type=float, default=1.0,  help="Contrastive loss margin")
    p.add_argument("--threshold",  type=float, default=0.5,  help="Distance threshold for eval accuracy")
    p.add_argument("--pairs",      type=int,   default=1000, help="Pairs generated per epoch")
    main(p.parse_args())
