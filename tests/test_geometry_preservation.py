from pathlib import Path

from PIL import Image

from visual_engine.compositor import compose_preview
from visual_engine.models import ModuleOverlay, Point
from visual_engine.roof_geometry import roof_plane_summary


def test_overlay_preserves_module_coordinates(tmp_path: Path):
    source = tmp_path / "source.png"
    output = tmp_path / "output.png"

    Image.new("RGB", (800, 600), "white").save(source)

    module = ModuleOverlay(
        id="module-01",
        row=1,
        column=1,
        polygon_px=[
            Point(x=100, y=100),
            Point(x=300, y=100),
            Point(x=300, y=220),
            Point(x=100, y=220),
        ],
        rotation_deg=0,
        power_w=680,
    )

    compose_preview(source, output, [module])

    assert output.exists()
    assert module.polygon_px[0].x == 100
    assert module.polygon_px[0].y == 100
    assert module.power_w == 680
    assert module.id == "module-01"
    assert module.rotation_deg == 0


def test_slope_conversion_matches_table():
    ten = roof_plane_summary(10)
    twenty = roof_plane_summary(20)
    thirty = roof_plane_summary(30)
    assert abs(ten["slope_angle_deg"] - 5.71) < 0.02
    assert abs(twenty["slope_angle_deg"] - 11.31) < 0.02
    assert abs(thirty["slope_angle_deg"] - 16.70) < 0.02
    assert abs(thirty["surface_factor"] - 1.044) < 0.002
