from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import Polygon


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    reason: str | None = None


def validate_module_on_roof(
    roof_polygon_surface: list[tuple[float, float]],
    module_polygon_surface: list[tuple[float, float]],
    obstacle_polygons_surface: list[list[tuple[float, float]]] | None = None,
) -> ValidationResult:
    """Valida o módulo no plano real da água."""
    roof = Polygon(roof_polygon_surface)
    module = Polygon(module_polygon_surface)

    if not roof.is_valid or not module.is_valid:
        return ValidationResult(False, "Geometria inválida.")

    if not roof.covers(module):
        return ValidationResult(False, "Módulo fora da área útil.")

    for obstacle_points in obstacle_polygons_surface or []:
        obstacle = Polygon(obstacle_points)
        if module.intersects(obstacle):
            return ValidationResult(False, "Módulo intercepta obstáculo.")

    return ValidationResult(True)
