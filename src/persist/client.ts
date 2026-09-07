import type { AppDefaults, ProjectState } from "../types";
import { FALLBACK_DEFAULTS, serializeEtiqueta } from "../types";

export interface PersistProject {
  version: 1;
  name: string;
  savedAt: string;
  id?: string;
  step: ProjectState["step"];
  tool: ProjectState["tool"];
  drawKind: ProjectState["drawKind"];
  grid_step_m: number;
  scale: ProjectState["scale"];
  scaleDraft: ProjectState["scaleDraft"];
  scale_input_m: number;
  ruler: ProjectState["ruler"];
  crop: ProjectState["crop"];
  redacts: ProjectState["redacts"];
  areas: ProjectState["areas"];
  obstacles: ProjectState["obstacles"];
  launches: ProjectState["launches"];
  launch_mode: ProjectState["launch_mode"];
  launch_orientation: ProjectState["launch_orientation"];
  module: ProjectState["module"];
  layout: ProjectState["layout"];
  georef?: ProjectState["georef"];
  etiqueta?: ProjectState["etiqueta"];
  image: {
    file: string;
    width_px: number;
    height_px: number;
    original_width_px: number;
    original_height_px: number;
    offset_px: ProjectState["image"] extends infer I
      ? I extends { offset_px: infer O }
        ? O
        : [number, number]
      : [number, number];
    hd_applied?: boolean;
  } | null;
}

export interface PersistStatus {
  temp: { exists: boolean; updatedAt?: string };
  projetos: Array<{ id: string; name: string; updatedAt: string; hasImage: boolean }>;
  historico: Array<{ id: string; name: string; updatedAt: string; hasImage: boolean }>;
  folders: { temp: string; projetos: string; imagens: string };
}

export interface LoadedPersist {
  exists: boolean;
  project?: PersistProject;
  imageUrl?: string | null;
  originalUrl?: string | null;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Falha HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function serializeProject(state: ProjectState, name: string): PersistProject {
  return {
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    step: state.step,
    tool: state.tool,
    drawKind: state.drawKind,
    grid_step_m: state.grid_step_m,
    scale: state.scale,
    scaleDraft: state.scaleDraft,
    scale_input_m: state.scale_input_m,
    ruler: state.ruler,
    crop: state.crop,
    redacts: state.redacts,
    areas: state.areas,
    obstacles: state.obstacles,
    launches: state.launches,
    launch_mode: state.launch_mode,
    launch_orientation: state.launch_orientation,
    module: state.module,
    layout: state.layout,
    georef: state.georef,
    etiqueta: serializeEtiqueta(state.etiqueta) as ProjectState["etiqueta"],
    image: state.image
      ? {
          file: state.image.file,
          width_px: state.image.width_px,
          height_px: state.image.height_px,
          original_width_px: state.image.original_width_px,
          original_height_px: state.image.original_height_px,
          offset_px: state.image.offset_px,
          hd_applied: state.image.hd_applied,
        }
      : null,
  };
}

export async function srcToBase64(src: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  if (!res.ok) return null;
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler a imagem para gravar."));
    reader.readAsDataURL(blob);
  });
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo importado."));
    reader.readAsDataURL(file);
  });
}

export async function loadDefaults(): Promise<AppDefaults> {
  try {
    const data = await readJson<Partial<AppDefaults>>(await fetch("/api/persist/defaults"));
    return { ...FALLBACK_DEFAULTS, ...data };
  } catch {
    return { ...FALLBACK_DEFAULTS };
  }
}

export async function saveDefaults(defaults: AppDefaults): Promise<AppDefaults> {
  return readJson(
    await fetch("/api/persist/defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaults),
    }),
  );
}

export async function persistStatus(): Promise<PersistStatus> {
  return readJson(await fetch("/api/persist/status"));
}

export async function loadTemp(): Promise<LoadedPersist> {
  return readJson(await fetch("/api/persist/temp"));
}

export async function loadSaved(scope: "projetos" | "historico", id: string): Promise<LoadedPersist> {
  return readJson(await fetch(`/api/persist/load/${scope}/${encodeURIComponent(id)}`));
}

export async function saveTemp(
  project: PersistProject,
  imageData?: string | null,
  originalData?: string | null,
): Promise<{ savedAt: string; folder: string }> {
  return readJson(
    await fetch("/api/persist/temp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        image: imageData ? { data: imageData } : undefined,
        original: originalData ? { data: originalData } : undefined,
      }),
    }),
  );
}

export async function saveNamedProject(
  name: string,
  project: PersistProject,
  imageData?: string | null,
  originalData?: string | null,
): Promise<{ id: string; folder: string; picturesPath: string | null; savedAt: string }> {
  return readJson(
    await fetch("/api/persist/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        project,
        image: imageData ? { data: imageData } : undefined,
        original: originalData ? { data: originalData } : undefined,
      }),
    }),
  );
}

export async function archiveTemp(): Promise<{ archived: boolean; id?: string; folder?: string }> {
  return readJson(await fetch("/api/persist/archive", { method: "POST" }));
}

export interface VisualEnhanceResult {
  status: "completed" | "fallback" | "error";
  enhanced_image_url?: string | null;
  composite_image_url?: string | null;
  technical_image_url?: string | null;
  warnings?: string[];
  geometry_preserved?: boolean;
  layout_reapplied?: boolean;
}

export async function requestEnhanceHd(imageData: string): Promise<{ ok: boolean; url?: string; width?: number; height?: number; error?: string }> {
  return readJson(
    await fetch("/api/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: { data: imageData }, mode: "hd" }),
    }),
  );
}

export async function requestGeoref(imageData: string): Promise<import("../types").GeoRef> {
  const res = await fetch("/api/georef", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: { data: imageData } }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "API do rodapé indisponível. Reinicie o npm run dev e tente de novo."
        : text || `Falha HTTP ${res.status}`,
    );
  }
  try {
    return JSON.parse(text) as import("../types").GeoRef;
  } catch {
    throw new Error("Resposta inválida do OCR do rodapé. Reinicie o servidor de desenvolvimento.");
  }
}

export async function requestVisualization(body: {
  project_id: string;
  mode: string;
  image: { data: string };
  modules: Array<{
    id: string;
    row: number;
    column: number;
    polygon_px: Array<{ x: number; y: number }>;
    rotation_deg: number;
    power_w: number;
    status: string;
  }>;
  obstacles: Array<{
    id: string;
    name: string;
    polygon_px: Array<{ x: number; y: number }>;
    visible: boolean;
  }>;
  show_modules: boolean;
  show_obstacles: boolean;
  include_warning: boolean;
}): Promise<VisualEnhanceResult> {
  return readJson(
    await fetch("/api/visualizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export interface SolarPositionRow {
  timestamp: string;
  azimuth: number;
  elevation: number;
  zenith: number;
  sun_up: boolean;
  sunrise: string;
  sunset: string;
  solar_transit?: string;
}

export interface SolarPositionResponse {
  ok: boolean;
  error?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  day?: string;
  samples?: number;
  rows?: SolarPositionRow[];
  solar_position_method?: string;
}

export interface SolarSimulateResponse {
  ok: boolean;
  error?: string;
  status?: string;
  samples?: number;
  shadow_hits?: number;
  results?: Array<Record<string, unknown>>;
  warning?: string;
}

export async function requestSolarScenarios(): Promise<{
  ok: boolean;
  scenarios?: Array<{ id: string; label: string; date_rule: string }>;
  dates_2026?: Record<string, string>;
  default_time_range?: { start: string; end: string; step_minutes: number };
  error?: string;
}> {
  return readJson(await fetch("/api/solar/scenarios"));
}

export async function requestSolarPosition(body: {
  latitude: number;
  longitude: number;
  timezone?: string;
  day: string;
  time_start?: string;
  time_end?: string;
  step_minutes?: number;
}): Promise<SolarPositionResponse> {
  return readJson(
    await fetch("/api/solar/position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function requestSolarSimulate(body: {
  config: {
    latitude: number;
    longitude: number;
    timezone?: string;
    day: string;
    time_start?: string;
    time_end?: string;
    step_minutes?: number;
    plane_z?: number;
    threshold_percent?: number;
  };
  obstacles: Array<Record<string, unknown>>;
  modules: Array<Record<string, unknown>>;
}): Promise<SolarSimulateResponse> {
  return readJson(
    await fetch("/api/solar/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
