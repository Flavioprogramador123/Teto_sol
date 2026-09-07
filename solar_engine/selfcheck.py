from __future__ import annotations

from datetime import date

from .coordinates import latlon_to_enu
from .scenarios import scenario_date
from .shadow_geometry import project_polygon_shadow_to_horizontal, shadow_intersects_module
from .solar_position import calculate_solar_position
from .vectors import shadow_direction_enu, sun_vector_enu


def main() -> int:
    anapolis = calculate_solar_position(
        latitude=-16.328,
        longitude=-48.953,
        timezone_name="America/Sao_Paulo",
        day=date(2026, 6, 21),
        time_start="12:00",
        time_end="12:00",
        step_minutes=15,
    )
    sao_paulo = calculate_solar_position(
        latitude=-23.550,
        longitude=-46.633,
        timezone_name="America/Sao_Paulo",
        day=date(2026, 6, 21),
        time_start="12:00",
        time_end="12:00",
        step_minutes=15,
    )
    assert not anapolis.empty and not sao_paulo.empty
    elev_a = float(anapolis.iloc[0]["elevation"])
    elev_sp = float(sao_paulo.iloc[0]["elevation"])
    assert elev_a != elev_sp, "Anápolis e São Paulo devem diferir"
    assert elev_a > elev_sp, "Ao meio-dia de junho, Anápolis deve ter Sol mais alto que SP"

    # Sol abaixo do horizonte → sem sombra
    try:
        shadow_direction_enu(0.0, -1.0)
        raise AssertionError("deveria falhar com Sol abaixo do horizonte")
    except ValueError:
        pass

    # Altura maior → sombra mais longa (distância do polígono ao centro projetado)
    low = project_polygon_shadow_to_horizontal(
        polygon_xy=[(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)],
        base_height_m=0.0,
        top_height_m=2.0,
        plane_z=0.0,
        solar_azimuth_deg=180.0,
        solar_elevation_deg=30.0,
        source_id="low",
    )
    high = project_polygon_shadow_to_horizontal(
        polygon_xy=[(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)],
        base_height_m=0.0,
        top_height_m=8.0,
        plane_z=0.0,
        solar_azimuth_deg=180.0,
        solar_elevation_deg=30.0,
        source_id="high",
    )
    assert low and high
    reach_low = abs(low.polygon_enu[0][1] - 0.0)
    reach_high = abs(high.polygon_enu[0][1] - 0.0)
    assert reach_high > reach_low, "obstáculo mais alto deve alongar a sombra"

    # Azimute muda a direção
    east = project_polygon_shadow_to_horizontal(
        [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)],
        0.0,
        4.0,
        0.0,
        90.0,
        45.0,
        "e",
    )
    west = project_polygon_shadow_to_horizontal(
        [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)],
        0.0,
        4.0,
        0.0,
        270.0,
        45.0,
        "w",
    )
    assert east and west
    assert east.polygon_enu[0][0] != west.polygon_enu[0][0], "azimute muda a sombra"

    # Solstício vs equinócio
    winter = calculate_solar_position(-16.328, -48.953, "America/Sao_Paulo", scenario_date("winter_solstice"), "12:00", "12:00", 15)
    equinox = calculate_solar_position(-16.328, -48.953, "America/Sao_Paulo", scenario_date("march_equinox"), "12:00", "12:00", 15)
    assert float(winter.iloc[0]["elevation"]) != float(equinox.iloc[0]["elevation"])

    # Interseção módulo
    module = [(10.0, 10.0), (12.0, 10.0), (12.0, 12.0), (10.0, 12.0)]
    miss = shadow_intersects_module([(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)], module)
    assert miss["status"] == "no_shadow"
    hit = shadow_intersects_module([(9.0, 9.0), (13.0, 9.0), (13.0, 13.0), (9.0, 13.0)], module)
    assert hit["status"] == "full_shadow"

    # ENU vinculado à origem
    e, n, u = latlon_to_enu(-16.328, -48.953, 0.0, -16.328, -48.953, 0.0)
    assert abs(e) < 1e-6 and abs(n) < 1e-6 and abs(u) < 1e-3

    v = sun_vector_enu(0.0, 90.0)
    assert abs(v[2] - 1.0) < 1e-6

    print(
        "solar_engine selfcheck ok",
        {
            "anapolis_elev": round(elev_a, 2),
            "sao_paulo_elev": round(elev_sp, 2),
            "shadow_reach_low_m": round(reach_low, 2),
            "shadow_reach_high_m": round(reach_high, 2),
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
