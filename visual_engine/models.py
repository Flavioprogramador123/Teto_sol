from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

VisualMode = Literal["technical", "presentation", "photorealistic"]


class Point(BaseModel):
    x: float
    y: float


class ModuleOverlay(BaseModel):
    id: str
    row: int = 1
    column: int = 1
    polygon_px: list[Point]
    rotation_deg: float = 0.0
    power_w: float = 680.0
    status: str = "valid"


class ObstacleOverlay(BaseModel):
    id: str
    name: str = "Obstáculo"
    polygon_px: list[Point]
    visible: bool = True


class VisualizationRequest(BaseModel):
    project_id: str
    source_image_path: str
    output_dir: str
    mode: VisualMode = "presentation"
    modules: list[ModuleOverlay] = Field(default_factory=list)
    obstacles: list[ObstacleOverlay] = Field(default_factory=list)
    show_modules: bool = True
    show_obstacles: bool = True
    show_dimensions: bool = True
    include_warning: bool = True


class VisualizationResult(BaseModel):
    status: Literal["completed", "fallback", "error"]
    source_image_path: str
    enhanced_image_path: str | None = None
    composite_image_path: str | None = None
    technical_image_path: str | None = None
    warnings: list[str] = Field(default_factory=list)
    geometry_preserved: bool = True
    layout_reapplied: bool = True
