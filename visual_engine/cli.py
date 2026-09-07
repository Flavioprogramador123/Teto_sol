from __future__ import annotations

import json
import sys
from pathlib import Path

from .georef import extract_georef
from .models import VisualizationRequest
from .service import create_visualization


def main() -> int:
    if len(sys.argv) >= 3 and sys.argv[1] == "georef":
        result = extract_georef(sys.argv[2])
        print(json.dumps(result, ensure_ascii=False))
        return 0
    if len(sys.argv) >= 4 and sys.argv[1] == "enhance":
        from PIL import Image

        from .enhance import enhance_image

        dest = Path(sys.argv[3])
        enhance_image(sys.argv[2], dest, sys.argv[4] if len(sys.argv) > 4 else "hd")
        with Image.open(dest) as out:
            print(json.dumps({"ok": True, "path": str(dest), "width": out.width, "height": out.height}))
        return 0
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "warnings": ["Uso: python -m visual_engine.cli request.json"]}))
        return 1
    payload = Path(sys.argv[1]).read_text(encoding="utf-8")
    request = VisualizationRequest.model_validate_json(payload)
    result = create_visualization(request)
    print(result.model_dump_json())
    return 0 if result.status != "error" else 2


if __name__ == "__main__":
    raise SystemExit(main())
