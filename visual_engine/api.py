from fastapi import FastAPI, HTTPException

from .models import VisualizationRequest, VisualizationResult
from .service import create_visualization

app = FastAPI(title="PlanoSol Visual Engine")


@app.post("/visualizations", response_model=VisualizationResult)
def generate_visualization(request: VisualizationRequest):
    try:
        return create_visualization(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
