from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

from .scenarios import SOLAR_SCENARIOS, scenario_date
from .simulation import ShadowSimulationConfig, simulate_horizontal_shadows
from .solar_position import add_sunrise_sunset, calculate_solar_position


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "selfcheck":
        from . import selfcheck

        return selfcheck.main()

    if len(sys.argv) >= 2 and sys.argv[1] == "position":
        lat = float(sys.argv[2]) if len(sys.argv) > 2 else -16.328
        lon = float(sys.argv[3]) if len(sys.argv) > 3 else -48.953
        day = date.fromisoformat(sys.argv[4]) if len(sys.argv) > 4 else date(2026, 6, 21)
        data = calculate_solar_position(
            latitude=lat,
            longitude=lon,
            timezone_name="America/Sao_Paulo",
            day=day,
            time_start="12:00",
            time_end="12:00",
            step_minutes=15,
        )
        data = add_sunrise_sunset(data, lat, lon, "America/Sao_Paulo")
        row = data.iloc[0]
        print(
            json.dumps(
                {
                    "latitude": lat,
                    "longitude": lon,
                    "timestamp": row["timestamp"].isoformat(),
                    "azimuth": float(row["azimuth"]),
                    "elevation": float(row["elevation"]),
                    "zenith": float(row["zenith"]),
                    "sun_up": bool(row["sun_up"]),
                    "sunrise": str(row["sunrise"]),
                    "sunset": str(row["sunset"]),
                },
                ensure_ascii=False,
            )
        )
        return 0

    if len(sys.argv) >= 2 and sys.argv[1] == "scenarios":
        print(json.dumps({"scenarios": SOLAR_SCENARIOS, "year_2026": {s["id"]: scenario_date(s["id"]).isoformat() for s in SOLAR_SCENARIOS}}, ensure_ascii=False))
        return 0

    if len(sys.argv) >= 2 and sys.argv[1] == "simulate":
        path = Path(sys.argv[2]) if len(sys.argv) > 2 else None
        if path and path.exists():
            payload = json.loads(path.read_text(encoding="utf-8"))
        else:
            payload = {
                "config": {
                    "latitude": -16.328,
                    "longitude": -48.953,
                    "timezone": "America/Sao_Paulo",
                    "day": "2026-06-21",
                    "time_start": "09:00",
                    "time_end": "09:00",
                    "step_minutes": 15,
                    "plane_z": 0.0,
                },
                "obstacles": [
                    {
                        "id": "obstaculo-01",
                        "polygon_local_m": [[4.0, 3.0], [5.5, 3.0], [5.5, 4.5], [4.0, 4.5]],
                        "base_height_m": 7.2,
                        "top_height_m": 9.2,
                        "casts_shadow": True,
                    }
                ],
                "modules": [
                    {
                        "id": "module-01",
                        "polygon_local_m": [[0.5, 0.5], [1.8, 0.5], [1.8, 2.8], [0.5, 2.8]],
                    }
                ],
            }
        cfg = payload["config"]
        config = ShadowSimulationConfig(
            latitude=float(cfg["latitude"]),
            longitude=float(cfg["longitude"]),
            timezone=cfg.get("timezone", "America/Sao_Paulo"),
            day=date.fromisoformat(cfg["day"]),
            time_start=cfg.get("time_start", "07:00"),
            time_end=cfg.get("time_end", "17:00"),
            step_minutes=int(cfg.get("step_minutes", 15)),
            plane_z=float(cfg.get("plane_z", 0.0)),
            threshold_percent=float(cfg.get("threshold_percent", 1.0)),
        )
        results = simulate_horizontal_shadows(config, payload["obstacles"], payload["modules"])
        print(json.dumps({"status": "completed", "samples": len(results), "results": results[:20]}, ensure_ascii=False))
        return 0

    print(
        json.dumps(
            {
                "status": "ok",
                "usage": [
                    "python -m solar_engine.cli selfcheck",
                    "python -m solar_engine.cli position [lat lon YYYY-MM-DD]",
                    "python -m solar_engine.cli scenarios",
                    "python -m solar_engine.cli simulate [payload.json]",
                ],
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
