import { spawnSync } from "node:child_process";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

const ROOT = process.cwd();
const STORAGE = path.join(ROOT, "storage");
const ORIGINAL = path.join(STORAGE, "original");
const PREVIEWS = path.join(STORAGE, "previews");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeJoin(root: string, ...parts: string[]) {
  const resolved = path.resolve(root, ...parts);
  const base = path.resolve(root);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error("Caminho inválido.");
  }
  return resolved;
}

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

function writeBase64File(filePath: string, data: string) {
  const raw = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  fs.writeFileSync(filePath, Buffer.from(raw, "base64"));
}

function pythonBin() {
  const win = process.platform === "win32";
  const local = path.join(ROOT, ".venv", win ? "Scripts" : "bin", win ? "python.exe" : "python");
  if (fs.existsSync(local)) return local;
  return win ? "python" : "python3";
}

function publicUrl(filePath: string) {
  const rel = path.relative(STORAGE, filePath).split(path.sep).join("/");
  return `/api/visual/file?name=${encodeURIComponent(rel)}&t=${Date.now()}`;
}

async function handleVisual(req: IncomingMessage, res: ServerResponse, url: URL) {
  const route = url.pathname.replace(/\/$/, "");

  if (req.method === "GET" && route === "/api/visual/file") {
    const name = url.searchParams.get("name") ?? "";
    const file = safeJoin(STORAGE, ...name.split("/").filter(Boolean));
    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      res.end("arquivo não encontrado");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.setHeader(
      "Content-Type",
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".json" ? "application/json" : "image/png",
    );
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file).pipe(res);
    return;
  }

  if (req.method === "POST" && route === "/api/enhance") {
    const body = JSON.parse(await readBody(req)) as { image?: { data: string }; mode?: string };
    if (!body.image?.data) {
      sendJson(res, 400, { ok: false, error: "Imagem não enviada." });
      return;
    }
    ensureDir(ORIGINAL);
    ensureDir(PREVIEWS);
    const sourcePath = path.join(ORIGINAL, "enhance-source.png");
    const destPath = path.join(PREVIEWS, "working-hd.jpg");
    writeBase64File(sourcePath, body.image.data);
    const mode = body.mode === "technical" || body.mode === "photorealistic" || body.mode === "presentation" ? body.mode : "hd";
    const ran = spawnSync(pythonBin(), ["-m", "visual_engine.cli", "enhance", sourcePath, destPath, mode], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 180000,
    });
    if (ran.error || ran.status !== 0 || !fs.existsSync(destPath)) {
      sendJson(res, 200, {
        ok: false,
        error: ran.error?.message ?? (ran.stderr || "Melhoria HD indisponível.").trim(),
      });
      return;
    }
    const lastLine = (ran.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() ?? "{}";
    let parsed: { width?: number; height?: number } = {};
    try {
      parsed = JSON.parse(lastLine) as { width?: number; height?: number };
    } catch {
      parsed = {};
    }
    sendJson(res, 200, {
      ok: true,
      url: publicUrl(destPath),
      width: parsed.width,
      height: parsed.height,
    });
    return;
  }

  if (req.method === "POST" && route === "/api/georef") {
    const body = JSON.parse(await readBody(req)) as { image?: { data: string } };
    if (!body.image?.data) {
      sendJson(res, 400, { confidence: "none", raw_text: "", north_up: true });
      return;
    }
    ensureDir(ORIGINAL);
    const sourcePath = path.join(ORIGINAL, "georef-source.png");
    writeBase64File(sourcePath, body.image.data);
    const ran = spawnSync(pythonBin(), ["-m", "visual_engine.cli", "georef", sourcePath], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120000,
    });
    if (ran.error || ran.status !== 0) {
      sendJson(res, 200, {
        source: "google_earth_web",
        north_up: true,
        heading_deg: 0,
        confidence: "none",
        raw_text: "",
        warnings: [ran.error?.message ?? (ran.stderr || "OCR do rodapé indisponível.").trim()],
      });
      return;
    }
    const lastLine = (ran.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() ?? "{}";
    sendJson(res, 200, JSON.parse(lastLine));
    return;
  }

  if (req.method === "GET" && route === "/api/reverse-geocode") {
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      sendJson(res, 400, { ok: false, error: "Informe latitude e longitude válidas." });
      return;
    }
    const nominatim = new URL("https://nominatim.openstreetmap.org/reverse");
    nominatim.searchParams.set("format", "jsonv2");
    nominatim.searchParams.set("lat", String(lat));
    nominatim.searchParams.set("lon", String(lon));
    nominatim.searchParams.set("addressdetails", "1");
    nominatim.searchParams.set("accept-language", "pt-BR");
    nominatim.searchParams.set("zoom", "18");
    try {
      const upstream = await fetch(nominatim, {
        headers: {
          "User-Agent": "PlanoSol/0.1 (projeto solar local; contato: planosol@localhost)",
          Accept: "application/json",
        },
      });
      if (!upstream.ok) {
        sendJson(res, 502, { ok: false, error: `Nominatim respondeu ${upstream.status}.` });
        return;
      }
      const data = (await upstream.json()) as Record<string, unknown>;
      sendJson(res, 200, { ok: true, ...data });
    } catch (err) {
      sendJson(res, 502, {
        ok: false,
        error: err instanceof Error ? err.message : "Falha ao consultar o endereço.",
      });
    }
    return;
  }

  if (req.method === "POST" && route === "/api/visualizations") {
    const body = JSON.parse(await readBody(req)) as {
      project_id?: string;
      mode?: string;
      image?: { data: string };
      modules?: unknown[];
      obstacles?: unknown[];
      show_modules?: boolean;
      show_obstacles?: boolean;
      include_warning?: boolean;
    };
    const projectId = (body.project_id || "projeto").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "projeto";
    ensureDir(ORIGINAL);
    ensureDir(PREVIEWS);
    if (!body.image?.data) {
      sendJson(res, 400, { status: "error", warnings: ["Imagem original não encontrada."] });
      return;
    }
    const sourcePath = path.join(ORIGINAL, `${projectId}.png`);
    writeBase64File(sourcePath, body.image.data);
    const requestPath = path.join(PREVIEWS, `${projectId}-request.json`);
    const request = {
      project_id: projectId,
      source_image_path: sourcePath,
      output_dir: PREVIEWS,
      mode: body.mode === "technical" || body.mode === "photorealistic" ? body.mode : "presentation",
      modules: body.modules ?? [],
      obstacles: body.obstacles ?? [],
      show_modules: body.show_modules !== false,
      show_obstacles: body.show_obstacles !== false,
      include_warning: body.include_warning !== false,
    };
    fs.writeFileSync(requestPath, JSON.stringify(request, null, 2), "utf8");

    const ran = spawnSync(pythonBin(), ["-m", "visual_engine.cli", requestPath], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120000,
    });

    if (ran.error || ran.status !== 0) {
      sendJson(res, 200, {
        status: "fallback",
        source_image_path: sourcePath,
        enhanced_image_url: null,
        composite_image_url: null,
        technical_image_url: null,
        warnings: [
          ran.error?.message ??
            (ran.stderr || ran.stdout || "Melhoria visual indisponível. A imagem original e o layout técnico continuam.").trim(),
        ],
        geometry_preserved: true,
        layout_reapplied: Boolean((body.modules ?? []).length),
      });
      return;
    }

    const lastLine = (ran.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop() ?? "{}";
    const parsed = JSON.parse(lastLine) as {
      status: string;
      enhanced_image_path?: string | null;
      composite_image_path?: string | null;
      technical_image_path?: string | null;
      warnings?: string[];
      geometry_preserved?: boolean;
      layout_reapplied?: boolean;
    };

    sendJson(res, 200, {
      status: parsed.status,
      enhanced_image_url: parsed.enhanced_image_path ? publicUrl(parsed.enhanced_image_path) : null,
      composite_image_url: parsed.composite_image_path ? publicUrl(parsed.composite_image_path) : null,
      technical_image_url: parsed.technical_image_path ? publicUrl(parsed.technical_image_path) : null,
      warnings: parsed.warnings ?? [],
      geometry_preserved: parsed.geometry_preserved !== false,
      layout_reapplied: parsed.layout_reapplied !== false,
    });
    return;
  }

  res.statusCode = 404;
  res.end("not found");
}

function attach(server: ViteDevServer) {
  server.middlewares.use(async (req, res, next) => {
    const raw = req.url ?? "";
    const pathname = raw.split("?")[0] ?? "";
    const handled =
      pathname.startsWith("/api/visual") ||
      pathname === "/api/georef" ||
      pathname === "/api/enhance" ||
      pathname === "/api/visualizations" ||
      pathname === "/api/reverse-geocode";
    if (!handled) {
      next();
      return;
    }
    try {
      const url = new URL(raw, "http://localhost");
      await handleVisual(req, res, url);
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Falha no módulo visual." });
    }
  });
}

export function pepileneVisual(): Plugin {
  return {
    name: "pepilene-visual",
    configureServer(server) {
      ensureDir(ORIGINAL);
      ensureDir(PREVIEWS);
      attach(server);
    },
    configurePreviewServer(server) {
      ensureDir(ORIGINAL);
      ensureDir(PREVIEWS);
      attach(server as unknown as ViteDevServer);
    },
  };
}
