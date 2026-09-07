from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

from .models import ModuleOverlay, ObstacleOverlay


def _points(points):
    return [(round(p.x), round(p.y)) for p in points]


def compose_preview(
    background_path: str | Path,
    output_path: str | Path,
    modules: list[ModuleOverlay],
    obstacles: list[ObstacleOverlay] | None = None,
    show_modules: bool = True,
    show_obstacles: bool = True,
    warning: bool = True,
) -> Path:
    """Compõe a apresentação usando coordenadas já calculadas pelo PlanoSol."""

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(background_path).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")

    if show_obstacles and obstacles:
        for obstacle in obstacles:
            if obstacle.visible and len(obstacle.polygon_px) >= 3:
                points = _points(obstacle.polygon_px)
                draw.polygon(points, fill=(220, 40, 40, 65), outline=(180, 20, 20, 220), width=3)

    if show_modules:
        for module in modules:
            if len(module.polygon_px) < 3:
                continue
            points = _points(module.polygon_px)
            draw.polygon(points, fill=(20, 115, 210, 125), outline=(5, 35, 80, 235), width=3)

    if warning:
        label = "SIMULAÇÃO VISUAL — layout calculado pelo PlanoSol"
        draw.rectangle((20, 20, 570, 56), fill=(0, 0, 0, 150))
        draw.text((30, 30), label, fill=(255, 255, 255, 255))

    image.convert("RGB").save(output_path, quality=95)
    return output_path


def compose_module_overlay(
    background_path: str | Path,
    output_path: str | Path,
    module_polygons_px: list[list[tuple[float, float]]],
    obstacle_polygons_px: list[list[tuple[float, float]]] | None = None,
    show_obstacles: bool = True,
) -> Path:
    image = Image.open(background_path).convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")

    if show_obstacles:
        for obstacle in obstacle_polygons_px or []:
            points = [(round(x), round(y)) for x, y in obstacle]
            draw.polygon(points, fill=(220, 40, 40, 65), outline=(180, 20, 20, 220), width=3)

    for module in module_polygons_px:
        points = [(round(x), round(y)) for x, y in module]
        draw.polygon(points, fill=(20, 115, 210, 125), outline=(5, 35, 80, 235), width=3)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output_path, quality=95)
    return output_path
