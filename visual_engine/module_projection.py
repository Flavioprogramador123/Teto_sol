from __future__ import annotations

from dataclasses import dataclass

from .roof_geometry import projected_length_from_surface


@dataclass(frozen=True)
class ModuleDimensions:
    width_m: float
    height_m: float


def project_module_dimensions(
    dimensions: ModuleDimensions,
    slope_percent: float,
    fall_axis: str = "height",
) -> ModuleDimensions:
    """Projeta dimensões para uma planta horizontal simplificada.

    A dimensão alinhada com a direção de queda é reduzida por cos(theta).
    Esta função não substitui homografia para imagens em perspectiva.
    """
    if fall_axis not in {"width", "height"}:
        raise ValueError("fall_axis deve ser 'width' ou 'height'.")

    if fall_axis == "width":
        return ModuleDimensions(
            width_m=projected_length_from_surface(dimensions.width_m, slope_percent),
            height_m=dimensions.height_m,
        )

    return ModuleDimensions(
        width_m=dimensions.width_m,
        height_m=projected_length_from_surface(dimensions.height_m, slope_percent),
    )
