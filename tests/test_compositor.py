from pathlib import Path

from PIL import Image

from visual_engine.compositor import compose_preview
from visual_engine.models import ModuleOverlay, ObstacleOverlay, Point


def test_compose_writes_preview(tmp_path: Path):
    source = tmp_path / "source.png"
    output = tmp_path / "preview.jpg"
    Image.new("RGB", (400, 300), "white").save(source)
    modules = [
        ModuleOverlay(
            id="module-01",
            polygon_px=[Point(x=10, y=10), Point(x=80, y=10), Point(x=80, y=60), Point(x=10, y=60)],
        )
    ]
    obstacles = [
        ObstacleOverlay(
            id="obs-01",
            polygon_px=[Point(x=200, y=40), Point(x=260, y=40), Point(x=260, y=90), Point(x=200, y=90)],
        )
    ]
    compose_preview(source, output, modules, obstacles)
    assert output.exists()
    assert Image.open(output).size == (400, 300)
