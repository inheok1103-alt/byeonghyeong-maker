# -*- coding: utf-8 -*-
"""Private offline OCR for RAY English images and scanned PDFs."""

from __future__ import annotations

import io
import re
import statistics
import sys
from pathlib import Path
from typing import BinaryIO


HERE = Path(__file__).resolve().parent
VENDOR_DIR = HERE / ".ray_ocr"
MAX_IMAGE_DIMENSION = 2400
MIN_CONFIDENCE = 0.24

_ENGINE = None


def _enable_vendor() -> None:
    value = str(VENDOR_DIR)
    if VENDOR_DIR.is_dir() and value not in sys.path:
        sys.path.insert(0, value)


def _engine():
    global _ENGINE
    if _ENGINE is None:
        _enable_vendor()
        try:
            from rapidocr_onnxruntime import RapidOCR
        except Exception as exc:
            raise RuntimeError(
                f"로컬 OCR 엔진을 불러오지 못했습니다: {exc}"
            ) from exc
        _ENGINE = RapidOCR()
    return _ENGINE


def _prepare_image(source: str | Path | bytes | BinaryIO):
    _enable_vendor()
    import numpy as np
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps

    if isinstance(source, (str, Path)):
        image = Image.open(source)
    elif isinstance(source, bytes):
        image = Image.open(io.BytesIO(source))
    else:
        image = Image.open(source)

    image = ImageOps.exif_transpose(image)
    if image.mode in {"RGBA", "LA"}:
        background = Image.new("RGB", image.size, "white")
        alpha = image.getchannel("A")
        background.paste(image.convert("RGB"), mask=alpha)
        image = background
    else:
        image = image.convert("RGB")

    width, height = image.size
    longest = max(width, height)
    if longest > MAX_IMAGE_DIMENSION:
        scale = MAX_IMAGE_DIMENSION / longest
        image = image.resize(
            (max(1, int(width * scale)), max(1, int(height * scale))),
            Image.Resampling.LANCZOS,
        )
    elif longest < 1100:
        scale = min(2.0, 1800 / max(1, longest))
        image = image.resize(
            (max(1, int(width * scale)), max(1, int(height * scale))),
            Image.Resampling.LANCZOS,
        )

    gray = ImageOps.grayscale(image)
    gray = ImageOps.autocontrast(gray, cutoff=1)
    gray = ImageEnhance.Contrast(gray).enhance(1.25)
    gray = gray.filter(ImageFilter.SHARPEN)
    return np.asarray(gray)


def _reading_order(rows: list, width: int, height: int) -> list[dict]:
    items: list[dict] = []
    for row in rows or []:
        if len(row) < 3:
            continue
        box, text, confidence = row[0], str(row[1]).strip(), float(row[2])
        if not text or confidence < MIN_CONFIDENCE:
            continue
        xs = [float(point[0]) for point in box]
        ys = [float(point[1]) for point in box]
        items.append(
            {
                "text": re.sub(r"\s+", " ", text),
                "confidence": confidence,
                "x0": min(xs),
                "x1": max(xs),
                "y0": min(ys),
                "y1": max(ys),
                "cx": (min(xs) + max(xs)) / 2,
                "height": max(1.0, max(ys) - min(ys)),
            }
        )

    content = [item for item in items if item["x1"] - item["x0"] < width * 0.58]
    left = [item for item in content if item["cx"] < width * 0.48]
    right = [item for item in content if item["cx"] > width * 0.52]
    two_columns = height > width * 1.08 and len(left) >= 6 and len(right) >= 6
    key = lambda item: (round(item["y0"] / 8), item["x0"])
    if not two_columns:
        return sorted(items, key=key)

    first_content_y = min((item["y0"] for item in content), default=0)
    wide = [item for item in items if item not in content]
    header = [item for item in wide if item["y0"] <= first_content_y + height * 0.07]
    footer = [item for item in wide if item not in header]
    middle = [item for item in content if item not in left and item not in right]
    return (
        sorted(header, key=key)
        + sorted(left, key=key)
        + sorted(middle, key=key)
        + sorted(right, key=key)
        + sorted(footer, key=key)
    )


def ocr_image(source: str | Path | bytes | BinaryIO) -> str:
    """Return OCR text without sending the image outside this computer."""
    image = _prepare_image(source)
    rows, _timing = _engine()(image)
    ordered = _reading_order(rows or [], int(image.shape[1]), int(image.shape[0]))
    if not ordered:
        return ""
    median_height = statistics.median(item["height"] for item in ordered)
    gap_threshold = max(12.0, median_height * 1.45)
    lines: list[str] = []
    previous = None
    for item in ordered:
        if previous:
            gap = item["y0"] - previous["y1"]
            column_reset = item["y0"] + gap_threshold < previous["y0"]
            if gap > gap_threshold or column_reset:
                lines.append("")
        lines.append(item["text"])
        previous = item
    return "\n".join(lines).strip()


def available() -> bool:
    try:
        _engine()
        return True
    except Exception:
        return False
