import { spawnSync } from "node:child_process";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

const ROOT = process.cwd();

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function pythonBin() {
  const win = process.platform === "win32";
  const local = path.join(ROOT, ".venv", win ? "Scripts" : "bin", win ? "python.exe" : "python");
  if (fs.existsSync(local)) return local;
  return win ? "python" : "python3";
}

function runSolar(mode: "position" | "simulate" | "scenarios", payload: unknown) {
  const tmp = path.join(os.tmpdir(), `pepilene-solar-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ mode, payload }), "utf8");
  const runner = `
import json, sys
from datetime import date
from pathlib import Path
req = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
mode = req.get("mode")
payload = req.get("payload") or {}
try:
    if mode == "scenarios":
        from solar_engine.scenarios import SOLAR_SCENARIOS, scenario_date, default_time_range
        out = {
            "ok": True,
            "scenarios": SOLAR_SCENARIOS,
            "dates_2026": {s["id"]: scenario_date(s["id"]).isoformat() for s in SOLAR_SCENARIOS},
            "default_time_range": default_time_range(),
        }
    elif mode == "position":
        from solar_engine.solar_position import add_sunrise_sunset, calculate_solar_position
        day = date.fromisoformat(payload["day"])
        data = calculate_solar_position(
            latitude=float(payload["latitude"]),
            longitude=float(payload["longitude"]),
            timezone_name=payload.get("timezone") or "America/Sao_Paulo",
            day=day,
            time_start=payload.get("time_start") or "12:00",
            time_end=payload.get("time_end") or payload.get("time_start") or "12:00",
            step_minutes=int(payload.get("step_minutes") or 15),
        )
        data = add_sunrise_sunset(
            data,
            float(payload["latitude"]),
            float(payload["longitude"]),
            payload.get("timezone") or "America/Sao_Paulo",
        )
        rows = []
        for _, row in data.iterrows():
            rows.append({
                "timestamp": row["timestamp"].isoformat(),
                "azimuth": float(row["azimuth"]),
                "elevation": float(row["elevation"]),
                "zenith": float(row["zenith"]),
                "sun_up": bool(row["sun_up"]),
                "sunrise": str(row["sunrise"]),
                "sunset": str(row["sunset"]),
                "solar_transit": str(row.get("solar_transit", "")),
            })
        out = {
            "ok": True,
            "latitude": float(payload["latitude"]),
            "longitude": float(payload["longitude"]),
            "timezone": payload.get("timezone") or "America/Sao_Paulo",
            "day": payload["day"],
            "samples": len(rows),
            "rows": rows,
            "solar_position_method": "nrel_spa",
        }
    elif mode == "simulate":
        from solar_engine.simulation import ShadowSimulationConfig, simulate_horizontal_shadows
        cfg = payload.get("config") or {}
        config = ShadowSimulationConfig(
            latitude=float(cfg["latitude"]),
            longitude=float(cfg["longitude"]),
            timezone=cfg.get("timezone") or "America/Sao_Paulo",
            day=date.fromisoformat(cfg["day"]),
            time_start=cfg.get("time_start") or "07:00",
            time_end=cfg.get("time_end") or "17:00",
            step_minutes=int(cfg.get("step_minutes") or 15),
            plane_z=float(cfg.get("plane_z") or 0.0),
            threshold_percent=float(cfg.get("threshold_percent") or 1.0),
        )
        results = simulate_horizontal_shadows(
            config,
            payload.get("obstacles") or [],
            payload.get("modules") or [],
        )
        shadowed = [r for r in results if r.get("status") in ("partial_shadow", "full_shadow")]
        out = {
            "ok": True,
            "status": "completed",
            "samples": len(results),
            "shadow_hits": len(shadowed),
            "results": results[:200],
            "geometry_reference": "local_enu",
            "solar_position_method": "nrel_spa",
            "warning": "Simulação geométrica de sombra; validar medidas em vistoria técnica.",
        }
    else:
        out = {"ok": False, "error": f"Modo desconhecido: {mode}"}
except Exception as exc:
    out = {"ok": False, "error": str(exc)}
print(json.dumps(out, ensure_ascii=False))
`;
  const ran = spawnSync(pythonBin(), ["-c", runner, tmp], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, PYTHONPATH: ROOT, PYTHONIOENCODING: "utf-8" },
  });
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  if (ran.error || ran.status !== 0) {
    return {
      ok: false,
      error: ran.error?.message ?? (ran.stderr || ran.stdout || "Falha no motor solar.").trim(),
    };
  }
  const lastLine = (ran.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() ?? "{}";
  try {
    return JSON.parse(lastLine);
  } catch {
    return { ok: false, error: "Resposta inválida do motor solar.", raw: lastLine.slice(0, 400) };
  }
}

async function handleSolar(req: IncomingMessage, res: ServerResponse, url: URL) {
  const route = url.pathname.replace(/\/$/, "");

  if (req.method === "GET" && route === "/api/solar/scenarios") {
    sendJson(res, 200, runSolar("scenarios", {}));
    return;
  }

  if (req.method === "POST" && route === "/api/solar/position") {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    sendJson(res, 200, runSolar("position", body));
    return;
  }

  if (req.method === "POST" && route === "/api/solar/simulate") {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    sendJson(res, 200, runSolar("simulate", body));
    return;
  }

  res.statusCode = 404;
  res.end("not found");
}

function attach(server: ViteDevServer) {
  server.middlewares.use(async (req, res, next) => {
    const raw = req.url ?? "";
    const pathname = raw.split("?")[0] ?? "";
    if (!pathname.startsWith("/api/solar")) {
      next();
      return;
    }
    try {
      const url = new URL(raw, "http://localhost");
      await handleSolar(req, res, url);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : "Falha no motor solar." });
    }
  });
}

export function pepileneSolar(): Plugin {
  return {
    name: "pepilene-solar",
    configureServer(server) {
      attach(server);
    },
    configurePreviewServer(server) {
      attach(server as unknown as ViteDevServer);
    },
  };
}
