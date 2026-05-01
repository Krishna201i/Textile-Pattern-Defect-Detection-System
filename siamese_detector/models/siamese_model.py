"""
Siamese Neural Network with pretrained ResNet18 backbone.
Both images share the SAME weights (siamese = shared twin network).
Output: Two embedding vectors whose Euclidean distance measures similarity.
"""

import torch
import torch.nn as nn
from torchvision import models


class SiameseNetwork(nn.Module):
    """
    Siamese Network: ResNet18 backbone → embedding head.
    Large distance  = different (defective)
    Small distance  = similar   (non-defective)
    """

    def __init__(self, embedding_dim: int = 128, pretrained: bool = True):
        super().__init__()

        # Load ResNet18 with ImageNet weights
        weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
        backbone = models.resnet18(weights=weights)

        # Drop the final FC classifier — keep feature extractor only
        # ResNet18 → (B, 512, 1, 1) before the FC layer
        self.feature_extractor = nn.Sequential(*list(backbone.children())[:-1])

        # Project 512-dim ResNet features → compact embedding vector
        self.embedding_head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.Linear(256, embedding_dim),
        )

    def forward_one(self, x: torch.Tensor) -> torch.Tensor:
        """Pass a single image through the shared network."""
        features = self.feature_extractor(x)   # (B, 512, 1, 1)
        return self.embedding_head(features)    # (B, embedding_dim)

    def forward(self, img1: torch.Tensor, img2: torch.Tensor):
        """
        Forward pass for both images simultaneously (shared weights).
        Returns (embedding1, embedding2).
        """
        return self.forward_one(img1), self.forward_one(img2)


def euclidean_distance(emb1: torch.Tensor, emb2: torch.Tensor) -> torch.Tensor:
    """
    L2 distance between two embedding tensors.
    Shape: (B, D) → (B,)
    """
    return torch.sqrt(torch.sum((emb1 - emb2) ** 2, dim=1) + 1e-8)
