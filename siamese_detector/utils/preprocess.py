"""
Image preprocessing utilities.

Provides:
    get_transforms()    → torchvision transforms for train / inference
    preprocess_pil()    → convert PIL image → model-ready tensor
    preprocess_file()   → load file path → model-ready tensor
"""

from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms

# ImageNet statistics — required because ResNet18 was trained on these
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]
IMAGE_SIZE    = 224


def get_transforms(mode: str = "train") -> transforms.Compose:
    """
    Returns the right transforms for training or inference.

    Training: adds mild augmentation (flip, color jitter).
    Inference: deterministic resize + normalize only.
    """
    normalize = transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)

    if mode == "train":
        return transforms.Compose([
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomVerticalFlip(p=0.3),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
            transforms.ToTensor(),
            normalize,
        ])
    # val / inference
    return transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        normalize,
    ])


def preprocess_pil(pil_image: Image.Image, device: torch.device) -> torch.Tensor:
    """
    Convert an in-memory PIL image to a batch tensor (1, 3, H, W).

    Args:
        pil_image: PIL.Image in any mode — will be converted to RGB.
        device:    Target torch.device.
    Returns:
        Float tensor of shape (1, 3, 224, 224) on `device`.
    """
    transform = get_transforms("inference")
    tensor    = transform(pil_image.convert("RGB"))   # (3, 224, 224)
    return tensor.unsqueeze(0).to(device)             # (1, 3, 224, 224)


def preprocess_file(image_path: str | Path, device: torch.device) -> torch.Tensor:
    """
    Load an image file and convert it to a model-ready batch tensor.

    Args:
        image_path: Path to the image file.
        device:     Target torch.device.
    Returns:
        Float tensor of shape (1, 3, 224, 224) on `device`.
    """
    img = Image.open(image_path).convert("RGB")
    return preprocess_pil(img, device)
