export type Pt = [number, number];

export type Step = "import" | "edit" | "scale" | "draw" | "layout";

export type Tool =
  | "pan"
  | "crop"
  | "redact"
  | "scale"
  | "heading"
  | "ruler"
  | "area"
  | "obstacle"
  | "select"
  | "place-module"
  | "launch"
  | "group";

export type LayoutStatus = "Aprovado" | "Parcial" | "Impossível";

export type ObstacleType =
  | "caixa_dagua"
  | "chamine"
  | "antena"
  | "claraboia"
  | "acesso"
  | "borda_tecnica"
  | "sombra"
  | "platibanda"
  | "aquecimento"
  | "pe_direito"
  | "outro";

export type ModuleOrientation = "paisagem" | "retrato";

export type DrawKind = "util" | "restrita" | "lancamento";

export type LaunchMode = "completa" | "mista" | "fracionada";

export interface RectPx {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageInfo {
  file: string;
  width_px: number;
  height_px: number;
  src: string;
  original_src: string;
  original_width_px: number;
  original_height_px: number;
  offset_px: Pt;
  hd_applied?: boolean;
}

export interface ScaleReference {
  point_a: Pt;
  point_b: Pt;
  real_distance_m: number;
}

export interface ScaleCheck {
  check_m: number;
  marked_px: number;
  marked_m: number;
  generated_px: number;
  generated_m: number;
  error_pct: number;
  ok: boolean;
  same_as_mark: boolean;
}

export interface GeoRef {
  source: "google_earth_web";
  north_up: boolean;
  heading_deg: number;
  latitude_deg: number | null;
  longitude_deg: number | null;
  lat_text: string | null;
  lon_text: string | null;
  elevation_m: number | null;
  camera_m: number | null;
  scale_bar_m: number | null;
  imagery_date: string | null;
  raw_text: string;
  confidence: "high" | "low" | "none";
  /** Endereço via reverse geocode (Nominatim) — alimenta o carimbo. */
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  address_display: string | null;
}

export interface ScaleHeading {
  point_a: Pt;
  point_b: Pt;
  azimuth_deg: number;
}

export interface ScaleInfo {
  meters_per_pixel: number;
  pixels_per_meter: number;
  reference: ScaleReference | null;
  heading: ScaleHeading | null;
  calibrated: boolean;
  verification_error_pct: number | null;
  check: ScaleCheck | null;
}

export type SlopeSource = "manual" | "datasheet" | "measured" | "suggested";
export type SlopeConfidence = "unconfirmed" | "confirmed";
export type ProjectionMode = "orthographic" | "homography";
export type VisualMode = "technical" | "presentation" | "photorealistic";

export interface RoofPlane {
  slope_percent: number;
  slope_angle_deg: number;
  fall_direction_deg: number;
  material: string;
  tile_model: string;
  slope_source: SlopeSource;
  slope_confidence: SlopeConfidence;
  projection_mode: ProjectionMode;
}

export interface RoofArea {
  id: string;
  name: string;
  polygon_px: Pt[];
  azimuth_deg: number | null;
  tilt_deg: number | null;
  allowed_orientations: ModuleOrientation[];
  margin_m: number;
  height_from_ground_m: number;
  active: boolean;
  roof_plane?: RoofPlane;
}

export interface VisualizationInfo {
  id: string;
  mode: VisualMode;
  enhanced_src: string | null;
  composite_src: string | null;
  technical_src: string | null;
  status: "idle" | "running" | "completed" | "fallback" | "error";
  warnings: string[];
  geometry_preserved: boolean;
  layout_reapplied: boolean;
  show_modules: boolean;
  show_obstacles: boolean;
  show_dimensions: boolean;
  /** Números nos módulos (view number) — usado na tela e no Gerar arquivo. */
  show_module_numbers: boolean;
  compare_original: boolean;
  use_enhanced: boolean;
  outdated: boolean;
}

export interface Obstacle {
  id: string;
  type: ObstacleType;
  name: string;
  polygon_px: Pt[];
  safety_margin_m: number;
  height_from_ground_m: number;
  excluded: boolean;
}

export interface ModuleSpec {
  brand: string;
  model: string;
  power_w: number;
  width_m: number;
  height_m: number;
  thickness_m: number;
  gap_m: number;
  quantity_target: number;
  rotation_allowed: boolean;
}

export interface PlacedModule {
  id: string;
  x_m: number;
  y_m: number;
  width_m: number;
  height_m: number;
  orientation: ModuleOrientation;
  rotation_deg?: number;
  source: "auto" | "manual";
  violation: string | null;
  launch_id?: string | null;
  area_id?: string | null;
}

export interface LaunchZone {
  id: string;
  name: string;
  polygon_px: Pt[];
  mode: LaunchMode;
  orientation?: ModuleOrientation;
  area_id: string | null;
}

export interface LayoutSolution {
  orientation: ModuleOrientation;
  modules: PlacedModule[];
  score: number;
  idle_area_m2: number;
  grid_offset_m: number;
  candidates_tested: number;
  accepted_candidates: number;
  rejected_outside: number;
  rejected_obstacle: number;
}

export interface LayoutResult {
  status: LayoutStatus;
  installed: number;
  requested: number;
  missing: number;
  power_wp: number;
  power_kwp: number;
  occupied_area_m2: number;
  best: LayoutSolution;
  alternatives: LayoutSolution[];
  usable_polygons_px: { areaId: string; polygon_px: Pt[]; error?: string }[];
  computed_at: number;
}

export interface Selection {
  kind: "none" | "area" | "obstacle" | "module" | "vertex" | "redact" | "launch" | "module-group";
  id: string | null;
  ids?: string[];
  vertexIndex?: number;
}

export interface ProjectState {
  image: ImageInfo | null;
  scale: ScaleInfo;
  areas: RoofArea[];
  obstacles: Obstacle[];
  module: ModuleSpec;
  layout: LayoutResult | null;
  step: Step;
  tool: Tool;
  selection: Selection;
  grid_step_m: number;
  draft: Pt[];
  scaleDraft: Pt[];
  headingDraft: Pt[];
  scale_input_m: number;
  ruler: { a: Pt; b: Pt } | null;
  crop: Omit<RectPx, "id"> | null;
  redacts: RectPx[];
  drawKind: DrawKind;
  launch_mode: LaunchMode;
  launch_orientation: ModuleOrientation;
  launches: LaunchZone[];
  busy: boolean;
  notice: string | null;
  persist: PersistInfo;
  visualization: VisualizationInfo;
  georef: GeoRef;
  etiqueta: Etiqueta;
}

export interface Etiqueta {
  titulo: string;
  /** Dados do cliente — vazios / null em projeto novo; gravados no JSON após preenchimento. */
  cliente: string;
  endereco: string;
  bairro: string;
  cidade: string;
  data: string;
  responsavel: string;
  empresa: string;
  slogan: string;
  logo_src: string | null;
}

/** Marca PIENG fixa; cliente/endereço vazios para novo projeto. */
export const DEFAULT_ETIQUETA: Etiqueta = {
  titulo: "PROJEÇÃO DE IMPLANTAÇÃO",
  cliente: "",
  endereco: "",
  bairro: "",
  cidade: "",
  data: "",
  responsavel: "",
  empresa: "PIENG SOLUÇÕES ENERGÉTICAS",
  slogan: "Energia solar para um futuro mais sustentável!",
  logo_src: null,
};

/** Etiqueta limpa para novo cliente (mesmo que DEFAULT). */
export function freshEtiqueta(): Etiqueta {
  return { ...DEFAULT_ETIQUETA };
}

/** Normaliza o que veio do JSON (null → string vazia). */
export function hydrateEtiqueta(raw?: Partial<Etiqueta> | null): Etiqueta {
  if (!raw) return freshEtiqueta();
  const str = (v: unknown) => (v == null ? "" : String(v));
  return {
    titulo: str(raw.titulo) || DEFAULT_ETIQUETA.titulo,
    cliente: str(raw.cliente),
    endereco: str(raw.endereco),
    bairro: str(raw.bairro),
    cidade: str(raw.cidade),
    data: str(raw.data),
    responsavel: str(raw.responsavel),
    empresa: str(raw.empresa) || DEFAULT_ETIQUETA.empresa,
    slogan: str(raw.slogan) || DEFAULT_ETIQUETA.slogan,
    logo_src: raw.logo_src ?? null,
  };
}

/**
 * Grava no JSON: campos de cliente vazios saem como null (novo / sem preenchimento).
 * Marca/empresa/slogan mantêm texto padrão.
 */
export function serializeEtiqueta(e: Etiqueta): Record<string, string | null> {
  const emptyNull = (v: string) => (v.trim() ? v.trim() : null);
  return {
    titulo: e.titulo.trim() || DEFAULT_ETIQUETA.titulo,
    cliente: emptyNull(e.cliente),
    endereco: emptyNull(e.endereco),
    bairro: emptyNull(e.bairro),
    cidade: emptyNull(e.cidade),
    data: emptyNull(e.data),
    responsavel: emptyNull(e.responsavel),
    empresa: e.empresa.trim() || DEFAULT_ETIQUETA.empresa,
    slogan: e.slogan.trim() || DEFAULT_ETIQUETA.slogan,
    logo_src: e.logo_src,
  };
}

export interface PersistInfo {
  name: string;
  last_temp_at: string | null;
  last_saved_at: string | null;
  last_saved_id: string | null;
  last_saved_path: string | null;
  last_pictures_path: string | null;
  dirty: boolean;
}

export interface AppDefaults {
  area_margin_m: number;
  obstacle_safety_m: number;
  module_gap_m: number;
  launch_orientation: ModuleOrientation;
  show_launch_rects: boolean;
}

export const FALLBACK_DEFAULTS: AppDefaults = {
  area_margin_m: 0,
  obstacle_safety_m: 0.8,
  module_gap_m: 0.02,
  launch_orientation: "paisagem",
  show_launch_rects: false,
};

export const DEFAULT_MODULE: ModuleSpec = {
  brand: "RENEPV",
  model: "680W",
  power_w: 680,
  width_m: 2.384,
  height_m: 1.303,
  thickness_m: 0.035,
  gap_m: 0.02,
  quantity_target: 18,
  rotation_allowed: true,
};

export const EMPTY_VISUALIZATION: VisualizationInfo = {
  id: "",
  mode: "presentation",
  enhanced_src: null,
  composite_src: null,
  technical_src: null,
  status: "idle",
  warnings: [],
  geometry_preserved: true,
  layout_reapplied: false,
  show_modules: true,
  show_obstacles: true,
  show_dimensions: true,
  show_module_numbers: false,
  compare_original: false,
  use_enhanced: false,
  outdated: false,
};

export const EMPTY_PERSIST: PersistInfo = {
  name: "Projeto sem nome",
  last_temp_at: null,
  last_saved_at: null,
  last_saved_id: null,
  last_saved_path: null,
  last_pictures_path: null,
  dirty: false,
};

export const EMPTY_GEOREF: GeoRef = {
  source: "google_earth_web",
  north_up: true,
  heading_deg: 0,
  latitude_deg: null,
  longitude_deg: null,
  lat_text: null,
  lon_text: null,
  elevation_m: null,
  camera_m: null,
  scale_bar_m: null,
  imagery_date: null,
  raw_text: "",
  confidence: "none",
  endereco: null,
  bairro: null,
  cidade: null,
  address_display: null,
};

export const EMPTY_SCALE: ScaleInfo = {
  meters_per_pixel: 0,
  pixels_per_meter: 0,
  reference: null,
  heading: null,
  check: null,
  calibrated: false,
  verification_error_pct: null,
};

export const OBSTACLE_LABELS: Record<ObstacleType, string> = {
  caixa_dagua: "Caixa d'água",
  chamine: "Chaminé",
  antena: "Antena",
  claraboia: "Claraboia",
  acesso: "Acesso de manutenção",
  borda_tecnica: "Borda técnica",
  sombra: "Área sombreada",
  platibanda: "Platibanda",
  aquecimento: "Aquecimento de água",
  pe_direito: "Sala / pé-direito alto",
  outro: "Outro",
};

export const DRAW_KIND_LABELS: Record<DrawKind, string> = {
  util: "Área útil",
  restrita: "Área restrita / ocupada",
  lancamento: "Lançamento de módulos",
};

export const LAUNCH_MODE_LABELS: Record<LaunchMode, string> = {
  completa: "String completa · galpão",
  mista: "Mista · telhado amplo",
  fracionada: "Fracionada · platibandas",
};
