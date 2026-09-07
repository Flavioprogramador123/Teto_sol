from __future__ import annotations

import numpy as np


def intersect_ray_with_plane(
    ray_origin: np.ndarray,
    ray_direction: np.ndarray,
    plane_origin: np.ndarray,
    plane_u: np.ndarray,
    plane_v: np.ndarray,
) -> np.ndarray | None:
    """Intersecciona um raio com um plano 3D."""
    normal = np.cross(plane_u, plane_v)
    norm = np.linalg.norm(normal)
    if norm < 1e-12:
        raise ValueError("Os vetores do plano são colineares.")
    normal = normal / norm

    denominator = float(np.dot(ray_direction, normal))
    if abs(denominator) < 1e-12:
        return None

    t = float(np.dot(plane_origin - ray_origin, normal) / denominator)
    if t < 0:
        return None

    return ray_origin + t * ray_direction


def plane_coordinates(
    point: np.ndarray,
    plane_origin: np.ndarray,
    plane_u: np.ndarray,
    plane_v: np.ndarray,
) -> tuple[float, float]:
    """Obtém coordenadas locais aproximadas do ponto no plano."""
    delta = point - plane_origin
    u_norm = plane_u / np.linalg.norm(plane_u)
    v_norm = plane_v / np.linalg.norm(plane_v)
    return float(np.dot(delta, u_norm)), float(np.dot(delta, v_norm))
