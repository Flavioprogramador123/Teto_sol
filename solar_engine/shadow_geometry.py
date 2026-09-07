from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from shapely.geometry import Polygon

from .vectors import shadow_direction_enu


@dataclass(frozen=True)
class ShadowProjection:
    polygon_enu: list[tuple[float, float]]
    source_id: str
    solar_azimuth_deg: float
    solar_elevation_deg: float


def ray_to_horizontal_plane(
    origin_enu: np.ndarray,
    direction_enu: np.ndarray,
    plane_z: float,
) -> np.ndarray | None:
    """Calcula a interseção do raio com z = plane_z."""
    dz = direction_enu[2]
    if abs(dz) < 1e-12:
        return None

    t = (plane_z - origin_enu[2]) / dz
    if t < 0:
        return None

    return origin_enu + t * direction_enu


def project_polygon_shadow_to_horizontal(
    polygon_xy: list[tuple[float, float]],
    base_height_m: float,
    top_height_m: float,
    plane_z: float,
    solar_azimuth_deg: float,
    solar_elevation_deg: float,
    source_id: str,
) -> ShadowProjection | None:
    """Projeta os vértices superiores de um obstáculo no plano horizontal."""
    _ = base_height_m  # reservado para validação / versão inclinada
    direction = shadow_direction_enu(
        azimuth_deg=solar_azimuth_deg,
        elevation_deg=solar_elevation_deg,
    )

    projected: list[tuple[float, float]] = []
    for x, y in polygon_xy:
        origin = np.array([x, y, top_height_m], dtype=float)
        intersection = ray_to_horizontal_plane(origin, direction, plane_z)
        if intersection is None:
            return None
        projected.append((float(intersection[0]), float(intersection[1])))

    return ShadowProjection(
        polygon_enu=projected,
        source_id=source_id,
        solar_azimuth_deg=solar_azimuth_deg,
        solar_elevation_deg=solar_elevation_deg,
    )


def classify_shadow_status(percent: float, threshold_percent: float = 1.0) -> str:
    if percent < threshold_percent:
        return "no_shadow"
    if percent >= 95.0:
        return "full_shadow"
    return "partial_shadow"


def shadow_intersects_module(
    shadow_polygon: list[tuple[float, float]],
    module_polygon: list[tuple[float, float]],
    threshold_percent: float = 1.0,
) -> dict[str, float | bool | str]:
    """Calcula interseção simples entre sombra e módulo no mesmo plano."""
    shadow = Polygon(shadow_polygon)
    module = Polygon(module_polygon)

    if not shadow.is_valid or not module.is_valid or module.area <= 0:
        return {
            "intersects": False,
            "shadowed_area_percent": 0.0,
            "status": "insufficient_data",
        }

    intersection_area = shadow.intersection(module).area
    percent = 100.0 * intersection_area / module.area
    status = classify_shadow_status(percent, threshold_percent)

    return {
        "intersects": status != "no_shadow",
        "shadowed_area_percent": float(percent),
        "status": status,
    }
