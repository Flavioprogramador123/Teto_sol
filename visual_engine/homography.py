from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def compute_homography(
    source_points: list[tuple[float, float]],
    destination_points: list[tuple[float, float]],
) -> np.ndarray:
    """Calcula transformação entre quatro ou mais pontos correspondentes."""
    if len(source_points) < 4 or len(destination_points) < 4:
        raise ValueError("São necessários pelo menos quatro pontos.")

    source = np.asarray(source_points, dtype=np.float32)
    destination = np.asarray(destination_points, dtype=np.float32)

    matrix, _ = cv2.findHomography(source, destination, method=0)
    if matrix is None:
        raise ValueError("Não foi possível calcular a homografia.")

    return matrix


def transform_polygon(
    polygon_px: list[tuple[float, float]],
    homography: np.ndarray,
) -> list[tuple[float, float]]:
    points = np.asarray([polygon_px], dtype=np.float32)
    transformed = cv2.perspectiveTransform(points, homography)[0]
    return [(float(x), float(y)) for x, y in transformed]


def warp_overlay(
    overlay_path: str | Path,
    output_path: str | Path,
    homography: np.ndarray,
    output_size: tuple[int, int],
) -> Path:
    overlay = cv2.imread(str(overlay_path), cv2.IMREAD_UNCHANGED)
    if overlay is None:
        raise FileNotFoundError(overlay_path)

    warped = cv2.warpPerspective(overlay, homography, output_size)
    cv2.imwrite(str(output_path), warped)
    return Path(output_path)
