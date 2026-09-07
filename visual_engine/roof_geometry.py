from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class RoofSlope:
    slope_percent: float

    @property
    def angle_rad(self) -> float:
        return math.atan(self.slope_percent / 100.0)

    @property
    def angle_deg(self) -> float:
        return math.degrees(self.angle_rad)

    @property
    def cos_angle(self) -> float:
        return math.cos(self.angle_rad)

    @property
    def surface_factor(self) -> float:
        return 1.0 / self.cos_angle


def slope_to_angle(slope_percent: float) -> float:
    """Converte inclinação percentual para ângulo em radianos."""
    if slope_percent < 0:
        raise ValueError("A inclinação não pode ser negativa nesta versão.")
    return math.atan(slope_percent / 100.0)


def slope_to_degrees(slope_percent: float) -> float:
    return math.degrees(slope_to_angle(slope_percent))


def surface_length_from_plan(
    plan_length_m: float,
    slope_percent: float,
) -> float:
    """Retorna o comprimento real sobre a água inclinada."""
    if plan_length_m < 0:
        raise ValueError("O comprimento em planta não pode ser negativo.")
    angle = slope_to_angle(slope_percent)
    return plan_length_m / math.cos(angle)


def projected_length_from_surface(
    surface_length_m: float,
    slope_percent: float,
) -> float:
    """Retorna a projeção horizontal de uma dimensão sobre a queda."""
    if surface_length_m < 0:
        raise ValueError("O comprimento real não pode ser negativo.")
    angle = slope_to_angle(slope_percent)
    return surface_length_m * math.cos(angle)


def roof_plane_summary(slope_percent: float) -> dict[str, float]:
    slope = RoofSlope(slope_percent)
    return {
        "slope_percent": slope.slope_percent,
        "slope_angle_deg": slope.angle_deg,
        "cos_angle": slope.cos_angle,
        "surface_factor": slope.surface_factor,
    }


if __name__ == "__main__":
    for percent in (10.0, 20.0, 30.0):
        print(percent, roof_plane_summary(percent))
