import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

const ROOT = process.cwd();
const TEMP = path.join(ROOT, ".temp");
const TEMP_CURRENT = path.join(TEMP, "current");
const TEMP_HISTORY = path.join(TEMP, "historico");
const PROJETOS = path.join(ROOT, "projetos");
const DEFAULTS_FILE = path.join(ROOT, "defaults.json");
const MODULE_CATALOG_FILE = path.join(ROOT, "module_catalog.json");

const FALLBACK_DEFAULTS = {
  area_margin_m: 0,
  obstacle_safety_m: 0.8,
  module_gap_m: 0.02,
  launch_orientation: "paisagem",
  show_launch_rects: false,
};

function readDefaults() {
  if (!fs.existsSync(DEFAULTS_FILE)) {
    fs.writeFileSync(DEFAULTS_FILE, JSON.stringify(FALLBACK_DEFAULTS, null, 2), "utf8");
    return { ...FALLBACK_DEFAULTS };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DEFAULTS_FILE, "utf8")) as Record<string, unknown>;
    return {
      ...FALLBACK_DEFAULTS,
      ...raw,
      area_margin_m: Number(raw.area_margin_m ?? FALLBACK_DEFAULTS.area_margin_m),
      obstacle_safety_m: Number(raw.obstacle_safety_m ?? FALLBACK_DEFAULTS.obstacle_safety_m),
      module_gap_m: Number(raw.module_gap_m ?? FALLBACK_DEFAULTS.module_gap_m),
      launch_orientation: raw.launch_orientation === "retrato" ? "retrato" : "paisagem",
      show_launch_rects: Boolean(raw.show_launch_rects),
    };
  } catch {
    return { ...FALLBACK_DEFAULTS };
  }
}

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

function slugify(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
  return clean || "projeto";
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function writeBase64File(filePath: string, data: string) {
  const raw = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  fs.writeFileSync(filePath, Buffer.from(raw, "base64"));
}

function picturesRoot() {
  return path.join(os.homedir(), "Pictures", "PlanoSol");
}

function copyDir(from: string, to: string) {
  ensureDir(to);
  for (const entry of fs.readdirSync(from)) {
    fs.copyFileSync(path.join(from, entry), path.join(to, entry));
  }
}

function listFolder(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const folder = path.join(dir, e.name);
      const metaPath = path.join(folder, "project.json");
      let name = e.name;
      let updatedAt = fs.statSync(folder).mtime.toISOString();
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { name?: string; savedAt?: string };
          name = meta.name || name;
          updatedAt = meta.savedAt || updatedAt;
        } catch {
          /* ignore broken json */
        }
      }
      return {
        id: e.name,
        name,
        updatedAt,
        hasImage: fs.existsSync(path.join(folder, "image.png")) || fs.existsSync(path.join(folder, "image.jpg")),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function handlePersist(req: IncomingMessage, res: ServerResponse, url: URL) {
  const route = url.pathname.replace(/\/$/, "");

  if (req.method === "GET" && route === "/api/persist/defaults") {
    sendJson(res, 200, readDefaults());
    return;
  }

  if (req.method === "POST" && route === "/api/persist/defaults") {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    const next = {
      ...FALLBACK_DEFAULTS,
      ...readDefaults(),
      ...body,
      area_margin_m: Math.max(0, Number(body.area_margin_m ?? 0)),
      obstacle_safety_m: Math.max(0, Number(body.obstacle_safety_m ?? 0.8)),
      module_gap_m: Math.max(0, Number(body.module_gap_m ?? 0.02)),
      launch_orientation: body.launch_orientation === "retrato" ? "retrato" : "paisagem",
      show_launch_rects: Boolean(body.show_launch_rects),
    };
    fs.writeFileSync(DEFAULTS_FILE, JSON.stringify(next, null, 2), "utf8");
    sendJson(res, 200, next);
    return;
  }

  if (req.method === "GET" && route === "/api/persist/module-catalog") {
    if (!fs.existsSync(MODULE_CATALOG_FILE)) {
      sendJson(res, 404, { error: "module_catalog.json não encontrado." });
      return;
    }
    try {
      const data = JSON.parse(fs.readFileSync(MODULE_CATALOG_FILE, "utf8"));
      sendJson(res, 200, data);
    } catch {
      sendJson(res, 500, { error: "Falha ao ler module_catalog.json." });
    }
    return;
  }

  if (req.method === "POST" && route === "/api/persist/module-catalog") {
    const body = JSON.parse(await readBody(req)) as {
      default_id?: string;
      modules?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(body.modules) || body.modules.length === 0) {
      sendJson(res, 400, { error: "Informe ao menos um módulo no catálogo." });
      return;
    }
    const modules = body.modules.map((raw, i) => {
      const brand = String(raw.brand ?? "").trim() || "MARCA";
      const model = String(raw.model ?? "").trim() || "modelo";
      const power_w = Math.max(1, Number(raw.power_w) || 0);
      const idRaw = String(raw.id ?? "").trim();
      const id =
        idRaw ||
        `${brand}-${power_w}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase()
          .slice(0, 48) ||
        `mod-${i + 1}`;
      return {
        id,
        brand,
        model,
        power_w,
        width_m: Math.max(0.1, Number(raw.width_m) || 1),
        height_m: Math.max(0.1, Number(raw.height_m) || 1),
        thickness_m: Math.max(0.001, Number(raw.thickness_m) || 0.03),
        gap_m: Math.max(0, Number(raw.gap_m) || 0.02),
        notes: String(raw.notes ?? "").trim() || undefined,
      };
    });
    const ids = new Set(modules.map((m) => m.id));
    const default_id =
      body.default_id && ids.has(body.default_id) ? body.default_id : modules[0].id;
    const next = { default_id, modules };
    fs.writeFileSync(MODULE_CATALOG_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    sendJson(res, 200, next);
    return;
  }

  if (req.method === "GET" && route === "/api/persist/status") {
    ensureDir(TEMP_CURRENT);
    ensureDir(PROJETOS);
    const tempExists = fs.existsSync(path.join(TEMP_CURRENT, "project.json"));
    sendJson(res, 200, {
      temp: tempExists
        ? {
            exists: true,
            updatedAt: fs.statSync(path.join(TEMP_CURRENT, "project.json")).mtime.toISOString(),
          }
        : { exists: false },
      projetos: listFolder(PROJETOS),
      historico: listFolder(TEMP_HISTORY),
      folders: {
        temp: TEMP,
        projetos: PROJETOS,
        imagens: picturesRoot(),
      },
    });
    return;
  }

  if (req.method === "GET" && route === "/api/persist/temp") {
    const file = path.join(TEMP_CURRENT, "project.json");
    if (!fs.existsSync(file)) {
      sendJson(res, 200, { exists: false });
      return;
    }
    const project = JSON.parse(fs.readFileSync(file, "utf8"));
    sendJson(res, 200, {
      exists: true,
      project,
      imageUrl: fs.existsSync(path.join(TEMP_CURRENT, "image.png"))
        ? "/api/persist/file?scope=temp&name=image.png"
        : null,
      originalUrl: fs.existsSync(path.join(TEMP_CURRENT, "original.png"))
        ? "/api/persist/file?scope=temp&name=original.png"
        : null,
    });
    return;
  }

  if (req.method === "GET" && route === "/api/persist/file") {
    const scope = url.searchParams.get("scope") ?? "temp";
    const name = url.searchParams.get("name") ?? "image.png";
    const id = url.searchParams.get("id") ?? "";
    const root =
      scope === "projetos"
        ? safeJoin(PROJETOS, id)
        : scope === "historico"
          ? safeJoin(TEMP_HISTORY, id)
          : TEMP_CURRENT;
    const file = safeJoin(root, path.basename(name));
    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      res.end("arquivo não encontrado");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.setHeader("Content-Type", ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".json" ? "application/json" : "image/png");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file).pipe(res);
    return;
  }

  if (req.method === "POST" && route === "/api/persist/temp") {
    const body = JSON.parse(await readBody(req)) as {
      project: unknown;
      image?: { data: string };
      original?: { data: string };
    };
    ensureDir(TEMP_CURRENT);
    fs.writeFileSync(path.join(TEMP_CURRENT, "project.json"), JSON.stringify(body.project, null, 2), "utf8");
    if (body.image?.data) writeBase64File(path.join(TEMP_CURRENT, "image.png"), body.image.data);
    if (body.original?.data) writeBase64File(path.join(TEMP_CURRENT, "original.png"), body.original.data);
    sendJson(res, 200, {
      ok: true,
      savedAt: new Date().toISOString(),
      folder: TEMP_CURRENT,
    });
    return;
  }

  if (req.method === "POST" && route === "/api/persist/save") {
    const body = JSON.parse(await readBody(req)) as {
      name: string;
      project: { name?: string; savedAt?: string };
      image?: { data: string };
      original?: { data: string };
    };
    const id = `${stamp()}-${slugify(body.name || "projeto")}`;
    const folder = safeJoin(PROJETOS, id);
    ensureDir(folder);
    const project = { ...body.project, name: body.name || "Projeto", savedAt: new Date().toISOString(), id };
    fs.writeFileSync(path.join(folder, "project.json"), JSON.stringify(project, null, 2), "utf8");
    if (body.image?.data) writeBase64File(path.join(folder, "image.png"), body.image.data);
    else if (fs.existsSync(path.join(TEMP_CURRENT, "image.png"))) {
      fs.copyFileSync(path.join(TEMP_CURRENT, "image.png"), path.join(folder, "image.png"));
    }
    if (body.original?.data) writeBase64File(path.join(folder, "original.png"), body.original.data);
    else if (fs.existsSync(path.join(TEMP_CURRENT, "original.png"))) {
      fs.copyFileSync(path.join(TEMP_CURRENT, "original.png"), path.join(folder, "original.png"));
    }
    ensureDir(TEMP_CURRENT);
    fs.writeFileSync(path.join(TEMP_CURRENT, "project.json"), JSON.stringify(project, null, 2), "utf8");

    let picturesPath: string | null = null;
    try {
      const pictures = safeJoin(picturesRoot(), id);
      copyDir(folder, pictures);
      picturesPath = pictures;
    } catch {
      picturesPath = null;
    }

    sendJson(res, 200, {
      ok: true,
      id,
      folder,
      picturesPath,
      savedAt: project.savedAt,
    });
    return;
  }

  if (req.method === "POST" && route === "/api/persist/archive") {
    if (!fs.existsSync(path.join(TEMP_CURRENT, "project.json"))) {
      sendJson(res, 200, { ok: true, archived: false });
      return;
    }
    const id = stamp();
    const dest = safeJoin(TEMP_HISTORY, id);
    copyDir(TEMP_CURRENT, dest);
    sendJson(res, 200, { ok: true, archived: true, id, folder: dest });
    return;
  }

  if (req.method === "GET" && route.startsWith("/api/persist/load/")) {
    const parts = route.split("/").filter(Boolean);
    // api / persist / load / :scope / :id
    const scope = parts[3] ?? "";
    const id = decodeURIComponent(parts.slice(4).join("/"));
    if ((scope !== "projetos" && scope !== "historico") || !id) {
      sendJson(res, 400, { error: "Informe o escopo e o id do projeto." });
      return;
    }
    const root = scope === "projetos" ? safeJoin(PROJETOS, id) : safeJoin(TEMP_HISTORY, id);
    const file = path.join(root, "project.json");
    if (!fs.existsSync(file)) {
      sendJson(res, 404, { error: "Projeto não encontrado." });
      return;
    }
    const project = JSON.parse(fs.readFileSync(file, "utf8"));
    const imageName = fs.existsSync(path.join(root, "image.png"))
      ? "image.png"
      : fs.existsSync(path.join(root, "image.jpg"))
        ? "image.jpg"
        : null;
    const originalName = fs.existsSync(path.join(root, "original.png"))
      ? "original.png"
      : fs.existsSync(path.join(root, "original.jpg"))
        ? "original.jpg"
        : null;
    sendJson(res, 200, {
      exists: true,
      project,
      imageUrl: imageName
        ? `/api/persist/file?scope=${scope}&id=${encodeURIComponent(id)}&name=${imageName}`
        : null,
      originalUrl: originalName
        ? `/api/persist/file?scope=${scope}&id=${encodeURIComponent(id)}&name=${originalName}`
        : null,
    });
    return;
  }

  res.statusCode = 404;
  res.end("not found");
}

function attach(server: ViteDevServer) {
  server.middlewares.use(async (req, res, next) => {
    const raw = req.url ?? "";
    if (!raw.startsWith("/api/persist")) {
      next();
      return;
    }
    try {
      const url = new URL(raw, "http://localhost");
      await handlePersist(req, res, url);
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : "Falha ao gravar." });
    }
  });
}

export function pepilenePersist(): Plugin {
  return {
    name: "pepilene-persist",
    configureServer(server) {
      ensureDir(TEMP_CURRENT);
      ensureDir(TEMP_HISTORY);
      ensureDir(PROJETOS);
      attach(server);
    },
    configurePreviewServer(server) {
      ensureDir(TEMP_CURRENT);
      ensureDir(PROJETOS);
      attach(server as unknown as ViteDevServer);
    },
  };
}
