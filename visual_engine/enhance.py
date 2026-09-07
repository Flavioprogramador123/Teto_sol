from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

# Faixa da melhoria de imagem (lado maior), para calibração e modos leves.
ENHANCE_LONG_MIN = 512
ENHANCE_LONG_MAX = 768


def _mode_params(mode: str) -> tuple[float, float, float, float]:
    if mode == "technical":
        return 1.08, 1.02, 1.10, 1.02
    if mode == "photorealistic":
        return 1.12, 1.08, 1.18, 1.03
    if mode == "hd":
        return 1.16, 1.10, 1.28, 1.05
    return 1.10, 1.06, 1.15, 1.03


def normalize_enhance_size(
    width: int,
    height: int,
    min_long: int = ENHANCE_LONG_MIN,
    max_long: int = ENHANCE_LONG_MAX,
) -> tuple[int, int]:
    """Mantém a proporção e coloca o lado maior em [min_long, max_long]."""
    long_side = max(width, height)
    if long_side <= 0:
        return max(1, width), max(1, height)
    if long_side < min_long:
        factor = min_long / long_side
    elif long_side > max_long:
        factor = max_long / long_side
    else:
        return width, height
    return max(1, round(width * factor)), max(1, round(height * factor))


def _normalize_hd(image: Image.Image) -> Image.Image:
    width, height = normalize_enhance_size(image.width, image.height)
    if (width, height) == image.size:
        return image
    return image.resize((width, height), Image.Resampling.LANCZOS)


def enhance_image(
    source_path: str | Path,
    output_path: str | Path,
    mode: str = "presentation",
) -> Path:
    """Melhora a aparência. No modo hd, normaliza o lado maior para 512–768 px."""

    source_path = Path(source_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source_path) as source:
        image = source.convert("RGB")

    contrast, color, sharpness, brightness = _mode_params(mode)
    image = ImageEnhance.Contrast(image).enhance(contrast)
    image = ImageEnhance.Color(image).enhance(color)
    image = ImageEnhance.Brightness(image).enhance(brightness)
    image = ImageEnhance.Sharpness(image).enhance(sharpness)

    rgb = np.asarray(image)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    denoised = cv2.fastNlMeansDenoisingColored(
        bgr,
        None,
        h=4 if mode == "hd" else 3,
        hColor=4 if mode == "hd" else 3,
        templateWindowSize=7,
        searchWindowSize=21,
    )

    if mode == "hd":
        lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
        light, a_ch, b_ch = cv2.split(lab)
        light = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(light)
        denoised = cv2.cvtColor(cv2.merge((light, a_ch, b_ch)), cv2.COLOR_LAB2BGR)

    result = Image.fromarray(cv2.cvtColor(denoised, cv2.COLOR_BGR2RGB))
    if mode == "hd":
        result = _normalize_hd(result)
        result = result.filter(ImageFilter.UnsharpMask(radius=1.4, percent=130, threshold=2))
        result = ImageEnhance.Sharpness(result).enhance(1.1)

    result.save(output_path, quality=96)
    return output_path
