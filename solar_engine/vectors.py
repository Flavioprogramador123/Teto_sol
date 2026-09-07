from __future__ import annotations

import math

import numpy as np


def sun_vector_enu(
    azimuth_deg: float,
    elevation_deg: float,
) -> np.ndarray:
    """Vetor unitário apontando do ponto para o Sol (azimute a partir do Norte, horário)."""
    azimuth = math.radians(azimuth_deg)
    elevation = math.radians(elevation_deg)

    east = math.cos(elevation) * math.sin(azimuth)
    north = math.cos(elevation) * math.cos(azimuth)
    up = math.sin(elevation)

    vector = np.array([east, north, up], dtype=float)
    norm = np.linalg.norm(vector)
    if norm < 1e-12:
        raise ValueError("Vetor solar degenerado.")
    return vector / norm


def shadow_direction_enu(
    azimuth_deg: float,
    elevation_deg: float,
) -> np.ndarray:
    """Vetor na direção oposta ao Sol (para projeção de sombra)."""
    if elevation_deg <= 0:
        raise ValueError("Não existe sombra solar útil com o Sol abaixo do horizonte.")

    return -sun_vector_enu(azimuth_deg, elevation_deg)
