from __future__ import annotations

from pathlib import Path

from .compositor import compose_preview
from .enhance import enhance_image
from .models import VisualizationRequest, VisualizationResult


def create_visualization(request: VisualizationRequest) -> VisualizationResult:
    output_dir = Path(request.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    source_path = Path(request.source_image_path)
    enhanced_path = output_dir / f"{request.project_id}-enhanced.jpg"
    composite_path = output_dir / f"{request.project_id}-presentation.jpg"
    technical_path = output_dir / f"{request.project_id}-technical.jpg"

    if not source_path.exists():
        return VisualizationResult(
            status="error",
            source_image_path=str(source_path),
            warnings=["Imagem original não encontrada."],
            geometry_preserved=True,
            layout_reapplied=False,
        )

    try:
        enhance_image(source_path, enhanced_path, request.mode)

        compose_preview(
            enhanced_path,
            composite_path,
            modules=request.modules,
            obstacles=request.obstacles,
            show_modules=request.show_modules,
            show_obstacles=request.show_obstacles,
            warning=request.include_warning,
        )

        compose_preview(
            source_path,
            technical_path,
            modules=request.modules,
            obstacles=request.obstacles,
            show_modules=True,
            show_obstacles=True,
            warning=False,
        )

        warnings: list[str] = []
        if not request.modules:
            warnings.append("Imagem aprimorada sem layout técnico confirmado.")

        return VisualizationResult(
            status="completed",
            source_image_path=str(source_path),
            enhanced_image_path=str(enhanced_path),
            composite_image_path=str(composite_path),
            technical_image_path=str(technical_path),
            warnings=warnings,
            geometry_preserved=True,
            layout_reapplied=bool(request.modules),
        )

    except Exception as exc:
        fallback_path = output_dir / f"{request.project_id}-fallback.jpg"
        compose_preview(
            source_path,
            fallback_path,
            modules=request.modules,
            obstacles=request.obstacles,
            show_modules=True,
            show_obstacles=True,
            warning=True,
        )

        return VisualizationResult(
            status="fallback",
            source_image_path=str(source_path),
            composite_image_path=str(fallback_path),
            warnings=[f"Melhoria visual indisponível: {exc}"],
            geometry_preserved=True,
            layout_reapplied=True,
        )
