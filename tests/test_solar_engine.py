from datetime import date

from solar_engine.coordinates import latlon_to_enu
from solar_engine.scenarios import scenario_date
from solar_engine.shadow_geometry import project_polygon_shadow_to_horizontal, shadow_intersects_module
from solar_engine.solar_position import calculate_solar_position
from solar_engine.vectors import shadow_direction_enu


def test_latitudes_produce_different_solar_positions():
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
    assert not anapolis.empty
    assert not sao_paulo.empty
    assert float(anapolis.iloc[0]["elevation"]) != float(sao_paulo.iloc[0]["elevation"])
    assert float(anapolis.iloc[0]["elevation"]) > float(sao_paulo.iloc[0]["elevation"])


def test_taller_obstacle_longer_shadow():
    common = dict(
        polygon_xy=[(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)],
        base_height_m=0.0,
        plane_z=0.0,
        solar_azimuth_deg=180.0,
        solar_elevation_deg=30.0,
    )
    low = project_polygon_shadow_to_horizontal(**common, top_height_m=2.0, source_id="low")
    high = project_polygon_shadow_to_horizontal(**common, top_height_m=8.0, source_id="high")
    assert low and high
    assert abs(high.polygon_enu[0][1]) > abs(low.polygon_enu[0][1])


def test_no_shadow_below_horizon():
    try:
        shadow_direction_enu(45.0, -0.5)
        assert False, "esperado ValueError"
    except ValueError:
        pass


def test_azimuth_changes_shadow_direction():
    poly = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    a = project_polygon_shadow_to_horizontal(poly, 0.0, 4.0, 0.0, 90.0, 40.0, "a")
    b = project_polygon_shadow_to_horizontal(poly, 0.0, 4.0, 0.0, 270.0, 40.0, "b")
    assert a and b
    assert a.polygon_enu[0][0] != b.polygon_enu[0][0]


def test_solstice_vs_equinox():
    winter = calculate_solar_position(-16.328, -48.953, "America/Sao_Paulo", scenario_date("winter_solstice"), "12:00", "12:00", 15)
    equinox = calculate_solar_position(-16.328, -48.953, "America/Sao_Paulo", scenario_date("march_equinox"), "12:00", "12:00", 15)
    assert float(winter.iloc[0]["elevation"]) != float(equinox.iloc[0]["elevation"])


def test_module_outside_shadow_is_no_shadow():
    module = [(10.0, 10.0), (12.0, 10.0), (12.0, 12.0), (10.0, 12.0)]
    result = shadow_intersects_module([(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)], module)
    assert result["status"] == "no_shadow"


def test_module_fully_covered_is_full_shadow():
    module = [(10.0, 10.0), (12.0, 10.0), (12.0, 12.0), (10.0, 12.0)]
    result = shadow_intersects_module([(9.0, 9.0), (13.0, 9.0), (13.0, 13.0), (9.0, 13.0)], module)
    assert result["status"] == "full_shadow"


def test_enu_origin_stays_at_project_latlon():
    e, n, u = latlon_to_enu(-16.328, -48.953, 0.0, -16.328, -48.953, 0.0)
    assert abs(e) < 1e-6
    assert abs(n) < 1e-6
    assert abs(u) < 1e-3
