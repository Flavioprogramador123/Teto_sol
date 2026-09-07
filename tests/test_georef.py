from visual_engine.georef import parse_earth_meters, parse_georef_text


def test_google_earth_web_footer():
    text = "100% Atribuição de dados 21/07/2026 6 m 16°19.4580'S 48°55.5277'W 1.025 m Câmera: 1.074 m"
    geo = parse_georef_text(text)
    assert geo["north_up"] is True
    assert geo["heading_deg"] == 0.0
    assert abs(geo["latitude_deg"] - -(16 + 19.458 / 60)) < 1e-6
    assert abs(geo["longitude_deg"] - -(48 + 55.5277 / 60)) < 1e-6
    assert geo["scale_bar_m"] == 6
    assert geo["camera_m"] == 1074
    assert geo["elevation_m"] == 1025
    assert geo["imagery_date"] == "21/07/2026"
    assert geo["confidence"] == "high"


def test_thousands_separator():
    assert parse_earth_meters("1.074", "camera") == 1074
    assert parse_earth_meters("6", "scale") == 6
