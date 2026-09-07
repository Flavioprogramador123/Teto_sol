from __future__ import annotations

import math


def project_point_to_plan(
    x_surface_m: float,
    y_surface_m: float,
    slope_percent: float,
    fall_direction_deg: float,
    origin_x_m: float = 0.0,
    origin_y_m: float = 0.0,
) -> tuple[float, float]:
    """Projeta um ponto da superfície para uma planta horizontal.

    x_surface_m é considerado o eixo alinhado à queda antes da rotação.
    """
    theta = math.atan(slope_percent / 100.0)
    x_plan = x_surface_m * math.cos(theta)
    y_plan = y_surface_m

    angle = math.radians(fall_direction_deg)
    x_rotated = x_plan * math.cos(angle) - y_plan * math.sin(angle)
    y_rotated = x_plan * math.sin(angle) + y_plan * math.cos(angle)

    return origin_x_m + x_rotated, origin_y_m + y_rotated
