from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from .shadow_geometry import project_polygon_shadow_to_horizontal, shadow_intersects_module
from .solar_position import calculate_solar_position


@dataclass(frozen=True)
class ShadowSimulationConfig:
    latitude: float
    longitude: float
    timezone: str
    day: date
    time_start: str
    time_end: str
    step_minutes: int
    plane_z: float = 0.0
    threshold_percent: float = 1.0


def simulate_horizontal_shadows(
    config: ShadowSimulationConfig,
    obstacles: list[dict],
    modules: list[dict],
) -> list[dict]:
    """Simula sombra para obstáculos e módulos em plano horizontal.

    Não altera quantidade, posição ou potência dos módulos — apenas impacto de sombra.
    """
    positions = calculate_solar_position(
        latitude=config.latitude,
        longitude=config.longitude,
        timezone_name=config.timezone,
        day=config.day,
        time_start=config.time_start,
        time_end=config.time_end,
        step_minutes=config.step_minutes,
    )

    results: list[dict] = []

    for row in positions.itertuples(index=False):
        if float(row.elevation) <= 0:
            for module in modules:
                results.append(
                    {
                        "module_id": module["id"],
                        "obstacle_id": None,
                        "timestamp": row.timestamp.isoformat(),
                        "solar_azimuth_deg": float(row.azimuth),
                        "solar_elevation_deg": float(row.elevation),
                        "shadowed_area_percent": 0.0,
                        "status": "sun_below_horizon",
                    }
                )
            continue

        for obstacle in obstacles:
            if not obstacle.get("casts_shadow", True):
                continue

            shadow = project_polygon_shadow_to_horizontal(
                polygon_xy=obstacle["polygon_local_m"],
                base_height_m=float(obstacle["base_height_m"]),
                top_height_m=float(obstacle["top_height_m"]),
                plane_z=config.plane_z,
                solar_azimuth_deg=float(row.azimuth),
                solar_elevation_deg=float(row.elevation),
                source_id=obstacle["id"],
            )

            if shadow is None:
                continue

            for module in modules:
                module_poly = module.get("polygon_local_m") or module.get("polygon_surface_m")
                if not module_poly:
                    results.append(
                        {
                            "module_id": module["id"],
                            "obstacle_id": obstacle["id"],
                            "timestamp": row.timestamp.isoformat(),
                            "solar_azimuth_deg": float(row.azimuth),
                            "solar_elevation_deg": float(row.elevation),
                            "shadowed_area_percent": 0.0,
                            "status": "insufficient_data",
                        }
                    )
                    continue

                impact = shadow_intersects_module(
                    shadow_polygon=shadow.polygon_enu,
                    module_polygon=module_poly,
                    threshold_percent=config.threshold_percent,
                )

                results.append(
                    {
                        "module_id": module["id"],
                        "obstacle_id": obstacle["id"],
                        "timestamp": row.timestamp.isoformat(),
                        "solar_azimuth_deg": float(row.azimuth),
                        "solar_elevation_deg": float(row.elevation),
                        "shadowed_area_percent": impact["shadowed_area_percent"],
                        "status": impact["status"],
                    }
                )

    return results
