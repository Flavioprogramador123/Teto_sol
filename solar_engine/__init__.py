"""Motor Solar Geográfico do Pepilene — posição solar, ENU e sombras."""

from .coordinates import latlon_to_enu
from .inclined_plane import intersect_ray_with_plane
from .shadow_geometry import project_polygon_shadow_to_horizontal, shadow_intersects_module
from .simulation import ShadowSimulationConfig, simulate_horizontal_shadows
from .solar_position import add_sunrise_sunset, calculate_solar_position
from .vectors import shadow_direction_enu, sun_vector_enu

__all__ = [
    "ShadowSimulationConfig",
    "add_sunrise_sunset",
    "calculate_solar_position",
    "intersect_ray_with_plane",
    "latlon_to_enu",
    "project_polygon_shadow_to_horizontal",
    "shadow_direction_enu",
    "shadow_intersects_module",
    "simulate_horizontal_shadows",
    "sun_vector_enu",
]
