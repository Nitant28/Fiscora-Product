"""
Deterministic synthetic document generators for tests and benchmarks.

We avoid binary fixtures by rendering document-like images in code (white page +
black "text" bars) and degrading them in controlled ways. This keeps the test
suite hermetic and lets benchmarks sweep known defect types.
"""

from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

from app.contracts.document import (
    DocumentContract,
    DocumentMetadata,
    DocumentPage,
)


def make_clean_page(width: int = 1000, height: int = 1400) -> np.ndarray:
    """A crisp, well-exposed page: white background with dark text bars."""
    img = np.full((height, width, 3), 250, np.uint8)
    rng = np.random.default_rng(42)
    y = 90
    while y < height - 90:
        line_w = int(width * (0.55 + 0.4 * rng.random()))
        cv2.rectangle(img, (80, y), (80 + line_w, y + 16), (25, 25, 25), -1)
        y += 46
    return img


def degrade(
    image: np.ndarray,
    *,
    blur: int = 0,
    darken: float = 1.0,
    noise: float = 0.0,
    rotate: float = 0.0,
    low_contrast: bool = False,
    shadow: bool = False,
    seed: int = 7,
) -> np.ndarray:
    """Apply controlled degradations. Each defaults to a no-op."""
    out = image.copy()

    if low_contrast:
        out = (out.astype(np.float32) * 0.45 + 110).clip(0, 255).astype(np.uint8)

    if darken != 1.0:
        out = (out.astype(np.float32) * darken).clip(0, 255).astype(np.uint8)

    if shadow:
        h, w = out.shape[:2]
        gradient = np.tile(np.linspace(0.4, 1.0, w), (h, 1))
        out = (out.astype(np.float32) * gradient[:, :, None]).clip(0, 255).astype(np.uint8)

    if blur > 0:
        k = blur if blur % 2 == 1 else blur + 1
        out = cv2.GaussianBlur(out, (k, k), 0)

    if noise > 0.0:
        rng = np.random.default_rng(seed)
        gauss = rng.normal(0, noise, out.shape).astype(np.float32)
        out = (out.astype(np.float32) + gauss).clip(0, 255).astype(np.uint8)

    if rotate != 0.0:
        h, w = out.shape[:2]
        matrix = cv2.getRotationMatrix2D((w / 2, h / 2), rotate, 1.0)
        out = cv2.warpAffine(
            out, matrix, (w, h), borderMode=cv2.BORDER_REPLICATE
        )

    return out


def bgr_to_pil(bgr: np.ndarray) -> Image.Image:
    return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))


def make_document(pages_bgr: list[np.ndarray], dpi: int = 300) -> DocumentContract:
    pages: list[DocumentPage] = []
    for i, bgr in enumerate(pages_bgr, start=1):
        pil = bgr_to_pil(bgr)
        pages.append(
            DocumentPage(
                page_number=i,
                image=pil,
                width=pil.width,
                height=pil.height,
                dpi=dpi,
            )
        )
    metadata = DocumentMetadata(
        filename="synthetic.png",
        extension=".png",
        mime_type="image/png",
        file_size=0,
        sha256="0" * 64,
        total_pages=len(pages),
    )
    return DocumentContract(metadata=metadata, pages=pages)
