import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import modelo01 from "../../img/modelo01.png";
import earthWeb from "../../img/img02.png";
import { generateLayout, validatePlacement } from "../engine/layout";
import { layoutFromLaunchModules, packAllLaunches, packOrientedPolygon, sortModulesReadingOrder } from "../engine/launch";
import { buildingHeadingDeg, computeDirectScale, computeScale, verifyCalibration, verifyRuler } from "../engine/scale";
import { composeEditedImage, suggestChromeRedacts, suggestMapCrop } from "../engine/imageEdit";
import { enhanceHdCanvas } from "../engine/enhanceHd";
import { groupOverlapsOthers, modulePolygon, overlapsAnyModule, pointInPolygon, polygonsTouchOrOverlap, cullOverlappingModules } from "../engine/geometry";
import { uid } from "../lib/id";
import {
  etiquetaFromPiengBridge,
  moduleFromPiengBridge,
  parsePiengBridgePayload,
} from "../lib/piengBridge";
import { DEFAULT_ROOF_PLANE, normalizeRoofPlane, roofGridDeg } from "../engine/roofPlane";
import { formatGeoRef, parseGeorefText } from "../engine/georef";
import { reverseGeocode } from "../engine/reverseGeocode";
import { mToPx } from "../engine/scale";
import {
  archiveTemp,
  fileToBase64,
  loadDefaults,
  loadSaved,
  loadTemp,
  requestEnhanceHd,
  requestGeoref,
  requestVisualization,
  saveDefaults,
  saveNamedProject,
  saveTemp,
  serializeProject,
  srcToBase64,
} from "../persist/client";
import {
  DEFAULT_MODULE,
  EMPTY_GEOREF,
  EMPTY_PERSIST,
  EMPTY_SCALE,
  EMPTY_VISUALIZATION,
  freshEtiqueta,
  hydrateEtiqueta,
  FALLBACK_DEFAULTS,
  type ImageInfo,
  type LayoutResult,
  type ModuleSpec,
  type Obstacle,
  type PlacedModule,
  type ProjectState,
  type Pt,
  type RectPx,
  type RoofArea,
  type ScaleInfo,
  type Selection,
  type Step,
  type Tool,
  type DrawKind,
  type LaunchMode,
  type LaunchZone,
  type ModuleOrientation,
  type AppDefaults,
  type Etiqueta,
  type VisualizationInfo,
} from "../types";


interface ProjectApi {
  state: ProjectState;
  setStep: (step: Step) => void;
  setTool: (tool: Tool) => void;
  setNotice: (notice: string | null) => void;
  loadImage: (image: ImageInfo) => void;
  loadFile: (file: File) => Promise<void>;
  loadDemo: () => Promise<void>;
  loadEarthSample: () => Promise<void>;
  applyTwoPointScale: (a: Pt, b: Pt, meters: number) => void;
  applyHeading: (a: Pt, b: Pt) => void;
  setHeadingDraft: (pts: Pt[]) => void;
  clearHeading: () => void;
  setScaleInputM: (meters: number) => void;
  verifyScale: (checkMeters?: number) => void;
  clearScale: () => void;
  applyDirectScale: (pixelsPerMeter: number) => void;
  verifyConference: (a: Pt, b: Pt, expectedMeters: number) => void;
  setDraft: (pts: Pt[]) => void;
  setScaleDraft: (pts: Pt[]) => void;
  setRuler: (ruler: { a: Pt; b: Pt } | null) => void;
  addArea: (polygon_px: Pt[]) => void;
  addObstacle: (polygon_px: Pt[]) => void;
  finishOpenDraft: () => void;
  addLaunch: (polygon_px: Pt[]) => void;
  setDrawKind: (kind: DrawKind) => void;
  setLaunchMode: (mode: LaunchMode) => void;
  setLaunchOrientation: (orientation: ModuleOrientation) => void;
  selectModulesInPolygon: (polygon_px: Pt[]) => void;
  moveModuleGroup: (ids: string[], origins: Array<{ id: string; x_m: number; y_m: number }>, dx_m: number, dy_m: number) => void;
  updateArea: (id: string, patch: Partial<RoofArea>) => void;
  updateObstacle: (id: string, patch: Partial<Obstacle>) => void;
  updateLaunch: (id: string, patch: Partial<LaunchZone>) => void;
  deleteArea: (id: string) => void;
  deleteObstacle: (id: string) => void;
  deleteLaunch: (id: string) => void;
  setModule: (patch: Partial<ModuleSpec>) => void;
  /** Aplica JSON/postMessage do Gerador PIENG (módulo + etiqueta). */
  applyPiengBridge: (raw: unknown) => boolean;
  setGridStep: (step: number) => void;
  select: (selection: Selection) => void;
  refreshValidity: () => void;
  moveVertex: (kind: "area" | "obstacle" | "launch", id: string, index: number, point: Pt) => void;
  moveModule: (id: string, x_m: number, y_m: number) => void;
  rotateSelectedModules: () => void;
  deleteSelected: () => void;
  placeManualModule: (x_m: number, y_m: number) => void;
  calculate: () => void;
  clearLayout: () => void;
  setCrop: (crop: Omit<RectPx, "id"> | null) => void;
  addRedact: (rect: Omit<RectPx, "id">) => void;
  updateRedact: (id: string, rect: Omit<RectPx, "id">) => void;
  suggestMapFrame: () => void;
  suggestHideChrome: () => void;
  applyImageEdit: () => Promise<void>;
  applyEnhanceImage: () => Promise<void>;
  applyHdAndCalibrate: () => Promise<void>;
  restoreOriginalImage: () => Promise<void>;
  restoreSession: () => Promise<void>;
  saveProject: (name?: string) => Promise<void>;
  newProject: () => Promise<void>;
  openSaved: (scope: "projetos" | "historico", id: string) => Promise<void>;
  setProjectName: (name: string) => void;
  defaults: AppDefaults;
  saveAppDefaults: (next: AppDefaults) => Promise<void>;
  enhancePresentation: () => Promise<void>;
  patchVisualization: (patch: Partial<VisualizationInfo>) => void;
  restoreVisualizationOriginal: () => void;
  patchGeoref: (patch: Partial<import("../types").GeoRef>) => void;
  /** Busca endereço (OSM) a partir de lat/lon, grava em georef + etiqueta (JSON). */
  resolveAddress: (opts?: { overwriteEtiqueta?: boolean; lat?: number; lon?: number }) => Promise<{
    endereco: string;
    bairro: string;
    cidade: string;
    display: string;
  } | null>;
  updateEtiqueta: (patch: Partial<Etiqueta>) => void;
  readEarthFooter: () => Promise<import("../types").GeoRef | null>;
  markUndoPoint: (coalesce?: boolean) => void;
  endUndoGesture: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const ProjectContext = createContext<ProjectApi | null>(null);

function initialState(): ProjectState {
  return {
    image: null,
    scale: { ...EMPTY_SCALE },
    areas: [],
    obstacles: [],
    module: { ...DEFAULT_MODULE },
    layout: null,
    step: "import",
    tool: "pan",
    selection: { kind: "none", id: null },
    grid_step_m: 0.1,
    draft: [],
    scaleDraft: [],
    headingDraft: [],
    scale_input_m: 10,
    ruler: null,
    crop: null,
    redacts: [],
    drawKind: "util",
    launch_mode: "mista",
    launch_orientation: "paisagem",
    launches: [],
    busy: false,
    notice: null,
    persist: { ...EMPTY_PERSIST },
    visualization: { ...EMPTY_VISUALIZATION },
    georef: { ...EMPTY_GEOREF },
    etiqueta: freshEtiqueta(),
  };
}

function normalizeEarthGeoref(parsed: Partial<import("../types").GeoRef> & { raw_text?: string; warnings?: string[] }) {
  const fromText = parsed.raw_text ? parseGeorefText(parsed.raw_text) : { ...EMPTY_GEOREF };
  // Se o re-parse do texto OCR estiver sólido, use-o.
  if (fromText.confidence === "high") {
    return {
      ...EMPTY_GEOREF,
      ...fromText,
      north_up: true,
      heading_deg: 0,
      source: "google_earth_web" as const,
    };
  }
  // Senão preserve lat/lon/métricas já calculados pelo backend — não deixar null do re-parse apagar.
  const merged: import("../types").GeoRef = {
    ...EMPTY_GEOREF,
    ...fromText,
    ...parsed,
    north_up: true,
    heading_deg: 0,
    source: "google_earth_web",
    raw_text: parsed.raw_text ?? fromText.raw_text,
    latitude_deg: parsed.latitude_deg ?? fromText.latitude_deg,
    longitude_deg: parsed.longitude_deg ?? fromText.longitude_deg,
    lat_text: parsed.lat_text ?? fromText.lat_text,
    lon_text: parsed.lon_text ?? fromText.lon_text,
    scale_bar_m: parsed.scale_bar_m ?? fromText.scale_bar_m,
    camera_m: parsed.camera_m ?? fromText.camera_m,
    elevation_m: parsed.elevation_m ?? fromText.elevation_m,
    imagery_date: parsed.imagery_date ?? fromText.imagery_date,
    endereco: parsed.endereco ?? fromText.endereco ?? null,
    bairro: parsed.bairro ?? fromText.bairro ?? null,
    cidade: parsed.cidade ?? fromText.cidade ?? null,
    address_display: parsed.address_display ?? fromText.address_display ?? null,
  };
  if (merged.latitude_deg != null && merged.longitude_deg != null) merged.confidence = "high";
  else if (merged.scale_bar_m != null || merged.camera_m != null) merged.confidence = "low";
  else if (parsed.warnings?.length) merged.confidence = "none";
  else merged.confidence = fromText.confidence;
  return merged;
}

function readImageFile(src: string, file: string): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        file,
        width_px: img.naturalWidth,
        height_px: img.naturalHeight,
        src,
        original_src: src,
        original_width_px: img.naturalWidth,
        original_height_px: img.naturalHeight,
        offset_px: [0, 0],
        hd_applied: false,
      });
    };
    img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    img.src = src;
  });
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProjectState>(initialState);
  const [defaults, setDefaults] = useState<AppDefaults>(FALLBACK_DEFAULTS);
  const [historyLen, setHistoryLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);
  const readyRef = useRef(false);
  const sessionGenRef = useRef(0);
  const stateRef = useRef(state);
  const defaultsRef = useRef(defaults);
  const undoStackRef = useRef<ProjectState[]>([]);
  const redoStackRef = useRef<ProjectState[]>([]);
  const coalesceUndoRef = useRef(false);
  stateRef.current = state;
  defaultsRef.current = defaults;

  const resolveAddress = useCallback(
    async (opts?: { overwriteEtiqueta?: boolean; lat?: number; lon?: number }) => {
      const cur = stateRef.current;
      const lat = opts?.lat ?? cur.georef.latitude_deg;
      const lon = opts?.lon ?? cur.georef.longitude_deg;
      if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }
      try {
        const place = await reverseGeocode(lat, lon);
        setState((s) => ({
          ...s,
          georef: {
            ...s.georef,
            endereco: place.endereco || null,
            bairro: place.bairro || null,
            cidade: place.cidade || null,
            address_display: place.display || null,
          },
          // Etiqueta do carimbo é manual / JSON do projeto — não sobrescreve com OSM
          persist: { ...s.persist, dirty: true },
          notice: place.display
            ? `Endereço obtido: ${place.display}`
            : s.notice,
        }));
        return place;
      } catch (err) {
        setState((s) => ({
          ...s,
          notice:
            err instanceof Error
              ? `Endereço: ${err.message}`
              : "Não foi possível obter o endereço.",
        }));
        return null;
      }
    },
    [],
  );
  const resolveAddressRef = useRef(resolveAddress);
  resolveAddressRef.current = resolveAddress;

  const cloneForHistory = useCallback((s: ProjectState): ProjectState => {
    const image = s.image;
    const cloned = structuredClone({ ...s, image: null, busy: false }) as ProjectState;
    cloned.image = image ? { ...image } : null;
    return cloned;
  }, []);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    coalesceUndoRef.current = false;
    setHistoryLen(0);
    setRedoLen(0);
  }, []);

  const markUndoPoint = useCallback(
    (coalesce = false) => {
      if (coalesce && coalesceUndoRef.current) return;
      undoStackRef.current.push(cloneForHistory(stateRef.current));
      if (undoStackRef.current.length > 40) undoStackRef.current.shift();
      redoStackRef.current = [];
      coalesceUndoRef.current = coalesce;
      setHistoryLen(undoStackRef.current.length);
      setRedoLen(0);
    },
    [cloneForHistory],
  );

  const endUndoGesture = useCallback(() => {
    coalesceUndoRef.current = false;
  }, []);

  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) {
      setState((s) => ({ ...s, notice: "Nada para desfazer." }));
      return;
    }
    redoStackRef.current.push(cloneForHistory(stateRef.current));
    coalesceUndoRef.current = false;
    setHistoryLen(undoStackRef.current.length);
    setRedoLen(redoStackRef.current.length);
    setState({
      ...prev,
      busy: false,
      notice: "Última alteração desfeita.",
    });
  }, [cloneForHistory]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) {
      setState((s) => ({ ...s, notice: "Nada para refazer." }));
      return;
    }
    undoStackRef.current.push(cloneForHistory(stateRef.current));
    coalesceUndoRef.current = false;
    setHistoryLen(undoStackRef.current.length);
    setRedoLen(redoStackRef.current.length);
    setState({
      ...next,
      busy: false,
      notice: "Alteração refeita.",
    });
  }, [cloneForHistory]);

  useEffect(() => {
    void loadDefaults().then(setDefaults);
  }, []);

  const setStep = useCallback((step: Step) => {
    setState((s) => {
      // Na usina: descarta polígonos de lançamento (fantasma). Módulos permanecem.
      const clearLaunches = step === "layout";
      return {
        ...s,
        step,
        launches: clearLaunches ? [] : s.launches,
        tool:
          step === "edit"
            ? "crop"
            : step === "scale"
              ? "scale"
              : step === "draw"
                ? "area"
                : step === "layout"
                  ? "select"
                  : "pan",
        draft: [],
        notice: clearLaunches && (s.launches?.length ?? 0) > 0
          ? "Usina · retângulos de lançamento removidos da vista (módulos mantidos)."
          : null,
        selection:
          clearLaunches &&
          (s.selection.kind === "launch" || s.selection.kind === "area" || s.selection.kind === "obstacle")
            ? { kind: "none", id: null }
            : s.selection,
      };
    });
  }, []);

  const setTool = useCallback((tool: Tool) => {
    setState((s) => ({
      ...s,
      tool,
      draft: [],
      notice: null,
      ruler: tool === "ruler" ? s.ruler : null,
      selection:
        tool === "area" || tool === "obstacle" || tool === "launch" || tool === "group"
          ? { kind: "none", id: null }
          : s.selection,
    }));
  }, []);

  const setNotice = useCallback((notice: string | null) => {
    setState((s) => ({ ...s, notice }));
  }, []);

  const loadImage = useCallback((image: ImageInfo) => {
    setState(() => ({
      ...initialState(),
      image,
      step: "edit",
      tool: "crop",
      crop: suggestMapCrop(image.width_px, image.height_px),
      notice: image.file.includes("img02")
        ? "Google Earth Web · norte para cima. Recorte a busca, a bússola e o rodapé depois de ler o local."
        : image.file.includes("modelo01")
          ? "Recorte a barra, os ícones e os lotes que não entram no projeto. A moldura do mapa já veio sugerida."
          : "Recorte a imagem e tape informações sem interesse antes de calibrar a escala.",
    }));
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const gen = ++sessionGenRef.current;
    await archiveTemp();
    const data = await fileToBase64(file);
    const image = await readImageFile(URL.createObjectURL(file), file.name);
    const name = file.name.replace(/\.[^.]+$/, "") || "Projeto";
    const stamp = Date.now();
    const projectState: ProjectState = {
      ...initialState(),
      image: {
        ...image,
        src: `/api/persist/file?scope=temp&name=image.png&t=${stamp}`,
        original_src: `/api/persist/file?scope=temp&name=original.png&t=${stamp}`,
      },
      step: "edit",
      tool: "crop",
      crop: suggestMapCrop(image.width_px, image.height_px),
      persist: { ...EMPTY_PERSIST, name, dirty: true },
      busy: true,
      notice: `Imagem gravada em .temp (${file.name}). Lendo rodapé do Google Earth…`,
    };
    readyRef.current = true;
    clearHistory();
    await saveTemp(serializeProject(projectState, name), data, data);
    if (gen !== sessionGenRef.current) return;

    const stored = await readImageFile(projectState.image!.src, file.name);
    setState({
      ...projectState,
      image: {
        ...stored,
        original_src: projectState.image!.original_src,
        original_width_px: image.width_px,
        original_height_px: image.height_px,
      },
    });

    let georef = { ...EMPTY_GEOREF, north_up: true };
    let georefError: string | null = null;
    try {
      georef = normalizeEarthGeoref(await requestGeoref(data));
    } catch (err) {
      georefError = err instanceof Error ? err.message : "Falha ao ler o rodapé.";
      georef = { ...EMPTY_GEOREF, north_up: true };
    }
    if (gen !== sessionGenRef.current) return;

    const okGeo = georef.confidence === "high" || georef.scale_bar_m != null;
    setState((s) => ({
      ...s,
      georef,
      scale_input_m: georef.scale_bar_m ?? s.scale_input_m,
      busy: false,
      notice: okGeo
        ? `${formatGeoRef(georef)}. Local preenchido. Marque as pontas da barra de escala para calibrar.`
        : georefError
          ? `Imagem importada. Rodapé não lido: ${georefError}`
          : "Imagem importada. Norte para cima. Deixe a barra inferior visível e use Ler rodapé Earth.",
      persist: { ...s.persist, dirty: true },
    }));

    if (georef.latitude_deg != null && georef.longitude_deg != null) {
      void resolveAddressRef.current?.({
        lat: georef.latitude_deg,
        lon: georef.longitude_deg,
        overwriteEtiqueta: false,
      });
    }
  }, [clearHistory]);

  const loadDemo = useCallback(async () => {
    const res = await fetch(modelo01);
    const blob = await res.blob();
    const file = new File([blob], "modelo01.png", { type: blob.type || "image/png" });
    await loadFile(file);
  }, [loadFile]);

  const loadEarthSample = useCallback(async () => {
    const res = await fetch(earthWeb);
    const blob = await res.blob();
    const file = new File([blob], "img02.png", { type: blob.type || "image/png" });
    await loadFile(file);
  }, [loadFile]);

  const applyTwoPointScale = useCallback((a: Pt, b: Pt, meters: number) => {
    markUndoPoint();
    try {
      const scale = computeScale(a, b, meters);
      setState((s) => ({
        ...s,
        scale: { ...scale, heading: s.scale.heading },
        scaleDraft: [a, b],
        scale_input_m: meters,
        notice: `Escala de ${meters.toFixed(2)} m aplicada. A régua gerada aparece ao lado. Clique em Conferir escala.`,
        layout: null,
      }));
    } catch (err) {
      setState((s) => ({ ...s, notice: err instanceof Error ? err.message : "Falha na escala." }));
    }
  }, []);

  const applyHeading = useCallback((a: Pt, b: Pt) => {
    markUndoPoint();
    const azimuth_deg = Number(buildingHeadingDeg(a, b).toFixed(1));
    const grid = azimuth_deg - 90;
    const gridLabel = `${grid >= 0 ? "+" : ""}${grid.toFixed(1)}°`;
    setState((s) => {
      const heading = { point_a: a, point_b: b, azimuth_deg };
      const areas = s.areas.map((area) => ({
        ...area,
        azimuth_deg,
        roof_plane: { ...normalizeRoofPlane(area.roof_plane), fall_direction_deg: azimuth_deg },
      }));
      const packed =
        s.launches.length > 0 && s.scale.calibrated
          ? packAllLaunches(s.launches, areas, s.obstacles, s.module, s.scale.meters_per_pixel)
          : null;
      return {
        ...s,
        scale: { ...s.scale, heading },
        headingDraft: [a, b],
        areas,
        layout: packed ? packed.layout : s.layout,
        notice: `Bússola do imóvel em ${azimuth_deg}° (desvio ${gridLabel}). A figura não girou — os módulos seguem o muro.`,
      };
    });
  }, []);

  const setHeadingDraft = useCallback((headingDraft: Pt[]) => {
    setState((s) => ({ ...s, headingDraft }));
  }, []);

  const clearHeading = useCallback(() => {
    markUndoPoint();
    setState((s) => ({
      ...s,
      scale: { ...s.scale, heading: null },
      headingDraft: [],
      notice: "Direção do imóvel limpa. Trace de novo o muro ou a divisa.",
    }));
  }, []);

  const setScaleInputM = useCallback((meters: number) => {
    setState((s) => ({ ...s, scale_input_m: meters }));
  }, []);

  const verifyScale = useCallback((checkMeters = 10) => {
    setState((s) => {
      try {
        const check = verifyCalibration(s.scale, checkMeters);
        return {
          ...s,
          scale: { ...s.scale, check, verification_error_pct: check.error_pct, calibrated: check.ok || s.scale.calibrated },
          notice: check.same_as_mark
            ? check.ok
              ? `Conferência: a régua gerada de ${check.check_m.toFixed(2)} m tem ${check.generated_px.toFixed(1)} px — o mesmo comprimento da sua escala. Compare com a barra original do desenho.`
              : `A régua gerada não bate com a escala (${check.error_pct.toFixed(2)}%). Limpe e marque de novo as pontas da barra original.`
            : `Sua escala é ${check.marked_m.toFixed(2)} m (${check.marked_px.toFixed(1)} px). A régua gerada de ${check.check_m.toFixed(2)} m tem ${check.generated_px.toFixed(1)} px. A barra original de 10 m do desenho deve ter esse mesmo comprimento.`,
        };
      } catch (err) {
        return { ...s, notice: err instanceof Error ? err.message : "Não foi possível conferir." };
      }
    });
  }, []);

  const clearScale = useCallback(() => {
    markUndoPoint();
    setState((s) => ({
      ...s,
      scale: { ...EMPTY_SCALE, heading: s.scale.heading },
      scaleDraft: [],
      layout: null,
      selection: { kind: "none", id: null },
      notice: "Escala limpa. Digite o tamanho, marque as duas pontas da barra original e depois confira.",
    }));
  }, []);

  const applyDirectScale = useCallback((pixelsPerMeter: number) => {
    try {
      const scale = computeDirectScale(pixelsPerMeter);
      setState((s) => ({
        ...s,
        scale,
        notice: `Escala direta: ${scale.pixels_per_meter.toFixed(2)} px/m`,
        layout: null,
      }));
    } catch (err) {
      setState((s) => ({ ...s, notice: err instanceof Error ? err.message : "Falha na escala." }));
    }
  }, []);

  const verifyConference = useCallback((a: Pt, b: Pt, expectedMeters: number) => {
    setState((s) => {
      if (!s.scale.calibrated) return { ...s, notice: "Calibre a escala antes de conferir." };
      const check = verifyRuler(s.scale, a, b, expectedMeters);
      const scale: ScaleInfo = {
        ...s.scale,
        calibrated: check.ok,
        verification_error_pct: check.errorPct,
      };
      return {
        ...s,
        scale,
        ruler: { a, b },
        notice: check.ok
          ? `Régua conferida: ${check.measured_m.toFixed(3)} m (erro ${check.errorPct.toFixed(2)}%).`
          : `Régua não confere: mediu ${check.measured_m.toFixed(3)} m vs ${expectedMeters} m (erro ${check.errorPct.toFixed(2)}%). Projeto marcado como não calibrado.`,
      };
    });
  }, []);

  const setDraft = useCallback((draft: Pt[]) => {
    setState((s) => ({ ...s, draft }));
  }, []);

  const setScaleDraft = useCallback((scaleDraft: Pt[]) => {
    setState((s) => ({ ...s, scaleDraft }));
  }, []);

  const setRuler = useCallback((ruler: { a: Pt; b: Pt } | null) => {
    setState((s) => ({ ...s, ruler }));
  }, []);

  const setDrawKind = useCallback((drawKind: DrawKind) => {
    setState((s) => ({
      ...s,
      drawKind,
      tool: drawKind === "restrita" ? "obstacle" : drawKind === "lancamento" ? "launch" : "area",
      draft: [],
      selection: { kind: "none", id: null },
      notice:
        drawKind === "restrita"
          ? "Área restrita / ocupada: clique os vértices. Feche coincidindo com o primeiro ponto."
          : drawKind === "lancamento"
            ? "Lançamento: escolha retrato ou paisagem e arraste um retângulo na área verde. Os módulos aparecem na hora."
            : "Área útil: clique os vértices. Feche coincidindo com o primeiro ponto.",
    }));
  }, []);

  const setLaunchMode = useCallback((mode: LaunchMode) => {
    setState((s) => ({ ...s, launch_mode: mode }));
  }, []);

  const setLaunchOrientation = useCallback((orientation: ModuleOrientation) => {
    setState((s) => ({ ...s, launch_orientation: orientation }));
  }, []);

  const addArea = useCallback((polygon_px: Pt[]) => {
    markUndoPoint();
    const area: RoofArea = {
      id: uid("area"),
      name: "",
      polygon_px,
      azimuth_deg: null,
      tilt_deg: null,
      allowed_orientations: ["paisagem", "retrato"],
      margin_m: defaultsRef.current.area_margin_m,
      height_from_ground_m: 3,
      active: true,
      roof_plane: { ...DEFAULT_ROOF_PLANE },
    };
    setState((s) => {
      const name = `Telhado ${s.areas.length + 1}`;
      const azimuth_deg = s.scale.heading?.azimuth_deg ?? null;
      return {
        ...s,
        areas: [
          ...s.areas,
          {
            ...area,
            name,
            azimuth_deg,
            roof_plane: {
              ...DEFAULT_ROOF_PLANE,
              ...area.roof_plane,
              fall_direction_deg: azimuth_deg ?? DEFAULT_ROOF_PLANE.fall_direction_deg,
            },
          },
        ],
        draft: [],
        selection: { kind: "area", id: area.id },
        layout: null,
        notice: `Área útil «${name}» · preencha o card fixo em cima.`,
      };
    });
  }, [markUndoPoint]);

  const addObstacle = useCallback((polygon_px: Pt[]) => {
    markUndoPoint();
    const obstacle: Obstacle = {
      id: uid("obstaculo"),
      type: "caixa_dagua",
      name: "",
      polygon_px,
      safety_margin_m: defaultsRef.current.obstacle_safety_m,
      height_from_ground_m: 4.5,
      excluded: true,
    };
    setState((s) => {
      const name = `Restrita ${s.obstacles.length + 1}`;
      return {
        ...s,
        obstacles: [...s.obstacles, { ...obstacle, name }],
        draft: [],
        selection: { kind: "obstacle", id: obstacle.id },
        layout: null,
        notice: `Área restrita «${name}» · preencha o card fixo em cima.`,
      };
    });
  }, []);

  const updateArea = useCallback((id: string, patch: Partial<RoofArea>) => {
    setState((s) => {
      const areas = s.areas.map((a) => {
        if (a.id !== id) return a;
        const next = { ...a, ...patch };
        if (patch.roof_plane) {
          next.roof_plane = normalizeRoofPlane({ ...a.roof_plane, ...patch.roof_plane });
          next.tilt_deg = next.roof_plane.slope_angle_deg;
        }
        return next;
      });
      const geom = "azimuth_deg" in patch || "roof_plane" in patch || "margin_m" in patch || "polygon_px" in patch;
      const canRepack = geom && s.launches.length > 0 && s.scale.calibrated;
      const packed = canRepack
        ? packAllLaunches(s.launches, areas, s.obstacles, s.module, s.scale.meters_per_pixel)
        : null;
      return {
        ...s,
        areas,
        layout: packed ? packed.layout : geom ? null : s.layout,
        notice:
          packed && "azimuth_deg" in patch && patch.azimuth_deg != null
            ? `Módulos alinhados ao azimute ${patch.azimuth_deg}°.`
            : s.notice,
        visualization: { ...s.visualization, outdated: true },
      };
    });
  }, []);

  const addLaunch = useCallback((polygon_px: Pt[]) => {
    markUndoPoint();
    setState((s) => {
      if (!s.scale.calibrated) {
        return { ...s, draft: [], notice: "Calibre a escala antes de lançar os módulos." };
      }
      if (!s.areas.some((a) => a.active && a.polygon_px.length >= 3)) {
        return { ...s, draft: [], notice: "Desenhe a área útil antes de abrir o polígono de lançamento." };
      }
      const zone: LaunchZone = {
        id: uid("lanc"),
        name: `Lançamento ${s.launches.length + 1}`,
        polygon_px,
        mode: s.launch_mode,
        orientation: s.launch_orientation,
        area_id: null,
      };
      const others = (s.layout?.best.modules ?? []).filter((m) => m.launch_id !== zone.id);
      const packed = packOrientedPolygon(
        polygon_px,
        s.launch_orientation,
        s.areas,
        s.obstacles,
        s.module,
        s.scale.meters_per_pixel,
        zone.id,
        others,
      );
      if (packed.error) {
        return { ...s, draft: [], notice: packed.error };
      }
      if (!packed.modules.length) {
        return {
          ...s,
          draft: [],
          notice: "Nenhum módulo coube neste retângulo — lançamento não foi criado.",
        };
      }
      zone.area_id = packed.area_id;
      const launches = [...s.launches, zone];
      const layout = layoutFromLaunchModules([...others, ...packed.modules], s.module);
      return {
        ...s,
        launches,
        draft: [],
        selection: { kind: "none", id: null },
        tool: "launch",
        layout,
        notice: `${packed.modules.length} módulos em «${zone.name}». Continue lançando ou clique em Editar.`,
      };
    });
  }, [markUndoPoint]);

  /** Remove lançamentos sem nenhum módulo (polígonos fantasma). */
  const pruneEmptyLaunches = useCallback((s: ProjectState): ProjectState => {
    const liveIds = new Set(
      (s.layout?.best.modules ?? []).map((m) => m.launch_id).filter((id): id is string => Boolean(id)),
    );
    const launches = (s.launches ?? []).filter((z) => liveIds.has(z.id));
    if (launches.length === (s.launches ?? []).length) return s;
    return {
      ...s,
      launches,
      selection:
        s.selection.kind === "launch" && s.selection.id && !liveIds.has(s.selection.id)
          ? { kind: "none", id: null }
          : s.selection,
      notice:
        launches.length < (s.launches ?? []).length
          ? `Removidos ${(s.launches ?? []).length - launches.length} lançamento(s) vazio(s).`
          : s.notice,
    };
  }, []);

  const updateLaunch = useCallback((id: string, patch: Partial<LaunchZone>) => {
    setState((s) => {
      const launches = s.launches.map((z) => (z.id === id ? { ...z, ...patch } : z));
      const zone = launches.find((z) => z.id === id);
      if (!zone || !s.scale.calibrated) return { ...s, launches };
      const others = (s.layout?.best.modules ?? []).filter((m) => m.launch_id !== id);
      const packed = packOrientedPolygon(
        zone.polygon_px,
        zone.orientation ?? s.launch_orientation,
        s.areas,
        s.obstacles,
        s.module,
        s.scale.meters_per_pixel,
        zone.id,
        others,
      );
      if (!packed.modules.length) {
        return pruneEmptyLaunches({
          ...s,
          launches: s.launches.filter((z) => z.id !== id),
          layout: layoutFromLaunchModules(others, s.module),
          selection: s.selection.id === id ? { kind: "none", id: null } : s.selection,
          notice: packed.error ?? `«${zone.name}» ficou sem módulos e foi removido.`,
        });
      }
      const layout = layoutFromLaunchModules([...others, ...packed.modules], s.module);
      return {
        ...s,
        launches: launches.map((z) => (z.id === id ? { ...z, area_id: packed.area_id } : z)),
        layout,
        notice: packed.error ?? `${packed.modules.length} módulos em «${zone.name}».`,
      };
    });
  }, [pruneEmptyLaunches]);

  const deleteLaunch = useCallback((id: string) => {
    markUndoPoint();
    setState((s) => {
      const launches = s.launches.filter((z) => z.id !== id);
      const modules = (s.layout?.best.modules ?? []).filter((m) => m.launch_id !== id);
      return {
        ...s,
        launches,
        selection: s.selection.id === id ? { kind: "none", id: null } : s.selection,
        layout: modules.length || s.layout ? layoutFromLaunchModules(modules, s.module) : s.layout,
        notice: "Polígono de lançamento removido.",
      };
    });
  }, []);

  const updateObstacle = useCallback((id: string, patch: Partial<Obstacle>) => {
    setState((s) => ({
      ...s,
      obstacles: s.obstacles.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      layout: null,
    }));
  }, []);

  const deleteArea = useCallback((id: string) => {
    markUndoPoint();
    setState((s) => ({
      ...s,
      areas: s.areas.filter((a) => a.id !== id),
      selection: s.selection.id === id ? { kind: "none", id: null } : s.selection,
      layout: null,
    }));
  }, []);

  const deleteObstacle = useCallback((id: string) => {
    markUndoPoint();
    setState((s) => ({
      ...s,
      obstacles: s.obstacles.filter((o) => o.id !== id),
      selection: s.selection.id === id ? { kind: "none", id: null } : s.selection,
      layout: null,
    }));
  }, []);

  const setModule = useCallback((patch: Partial<ModuleSpec>) => {
    setState((s) => ({ ...s, module: { ...s.module, ...patch }, layout: null }));
  }, []);

  const applyPiengBridge = useCallback((raw: unknown) => {
    const parsed = parsePiengBridgePayload(raw);
    if (!parsed) return false;
    const module = moduleFromPiengBridge(parsed.module);
    const etiqueta = etiquetaFromPiengBridge(parsed.etiqueta);
    const nameHint =
      (etiqueta.cliente && etiqueta.cliente.trim()) ||
      (parsed.ref && String(parsed.ref)) ||
      "Projeto PIENG";
    setState((s) => ({
      ...s,
      module,
      etiqueta,
      layout: null,
      persist: {
        ...s.persist,
        name: s.persist.name === "Projeto sem nome" || !s.persist.name ? nameHint : s.persist.name,
        dirty: true,
      },
      notice: `Gerador PIENG: ${module.quantity_target}× ${module.brand} ${module.model} (${module.power_w} W · ${module.width_m.toFixed(3)}×${module.height_m.toFixed(3)} m)`,
    }));
    return true;
  }, []);

  const setGridStep = useCallback((grid_step_m: number) => {
    setState((s) => ({ ...s, grid_step_m }));
  }, []);

  const select = useCallback((selection: Selection) => {
    setState((s) => ({ ...s, selection }));
  }, []);

  const moveVertex = useCallback((kind: "area" | "obstacle" | "launch", id: string, index: number, point: Pt) => {
    markUndoPoint(true);
    setState((s) => {
      if (kind === "area") {
        return {
          ...s,
          areas: s.areas.map((a) =>
            a.id === id
              ? { ...a, polygon_px: a.polygon_px.map((p, i) => (i === index ? point : p)) }
              : a,
          ),
          layout: null,
        };
      }
      if (kind === "obstacle") {
        return {
          ...s,
          obstacles: s.obstacles.map((o) =>
            o.id === id
              ? { ...o, polygon_px: o.polygon_px.map((p, i) => (i === index ? point : p)) }
              : o,
          ),
          layout: null,
        };
      }
      const launches = s.launches.map((z) =>
        z.id === id ? { ...z, polygon_px: z.polygon_px.map((p, i) => (i === index ? point : p)) } : z,
      );
      const zone = launches.find((z) => z.id === id);
      if (!zone || !s.scale.calibrated) return { ...s, launches };
      const others = (s.layout?.best.modules ?? []).filter((m) => m.launch_id !== id);
      const packed = packOrientedPolygon(
        zone.polygon_px,
        zone.orientation ?? s.launch_orientation,
        s.areas,
        s.obstacles,
        s.module,
        s.scale.meters_per_pixel,
        zone.id,
        others,
      );
      if (!packed.modules.length) {
        return pruneEmptyLaunches({
          ...s,
          launches: s.launches.filter((z) => z.id !== id),
          layout: layoutFromLaunchModules(others, s.module),
          selection: s.selection.id === id ? { kind: "none", id: null } : s.selection,
          notice: "Lançamento sem módulos removido.",
        });
      }
      return {
        ...s,
        launches,
        layout: layoutFromLaunchModules([...others, ...packed.modules], s.module),
      };
    });
  }, [markUndoPoint, pruneEmptyLaunches]);

  const revalidateModules = useCallback((s: ProjectState, modules: PlacedModule[]): PlacedModule[] => {
    if (!s.scale.calibrated) return modules.map((m) => ({ ...m, violation: "Escala não calibrada." }));
    return modules.map((m) => ({
      ...m,
      violation: validatePlacement(
        modulePolygon(m),
        s.areas,
        s.obstacles,
        s.scale.meters_per_pixel,
        s.module.gap_m,
        modules,
        m.id,
      ),
    }));
  }, []);

  const refreshValidity = useCallback(() => {
    setState((s) => {
      if (!s.layout) return s;
      // Só revalida (marca vermelho). Não apaga módulos — apagar quebrava Grupo após Inserir 1 / clique.
      const checked = revalidateModules(s, s.layout.best.modules);
      const installed = checked.length;
      const base = layoutFromLaunchModules(checked, s.module);
      return {
        ...s,
        launches: s.step === "layout" ? [] : s.launches,
        layout: {
          ...base,
          installed,
          missing: Math.max(0, base.requested - installed),
          power_wp: installed * s.module.power_w,
          power_kwp: (installed * s.module.power_w) / 1000,
          status: installed === 0 ? "Impossível" : installed >= base.requested ? "Aprovado" : "Parcial",
          usable_polygons_px: s.layout.usable_polygons_px,
          computed_at: Date.now(),
        },
      };
    });
  }, [revalidateModules]);

  const selectModulesInPolygon = useCallback((polygon_px: Pt[]) => {
    setState((s) => {
      if (!Array.isArray(polygon_px) || polygon_px.length < 3) {
        return {
          ...s,
          notice: "Marque ao menos 3 pontos no mapa e clique em Fechar polígono.",
        };
      }
      if (!s.layout || !s.scale.calibrated) {
        return { ...s, draft: [], notice: "Não há módulos para selecionar." };
      }
      const mpp = s.scale.meters_per_pixel;
      const ids = s.layout.best.modules
        .filter((m) => {
          const modPx = modulePolygon({
            x_m: m.x_m / mpp,
            y_m: m.y_m / mpp,
            width_m: m.width_m / mpp,
            height_m: m.height_m / mpp,
            rotation_deg: m.rotation_deg,
          });
          const [cx, cy] = [(m.x_m + m.width_m / 2) / mpp, (m.y_m + m.height_m / 2) / mpp];
          return pointInPolygon([cx, cy], polygon_px) || polygonsTouchOrOverlap(modPx, polygon_px);
        })
        .map((m) => m.id);
      return {
        ...s,
        draft: [],
        tool: "group",
        selection: ids.length ? { kind: "module-group", id: ids[0], ids } : { kind: "none", id: null },
        notice: ids.length
          ? `${ids.length} módulos no bloco. Delete para excluir, Alt+arrastar para mover, ou desenhe outro polígono.`
          : "Nenhum módulo dentro do polígono. Desenhe em volta do grupo e feche de novo.",
      };
    });
  }, []);

  const finishOpenDraft = useCallback(() => {
    const s = stateRef.current;
    if (s.draft.length < 3) {
      setState((cur) => ({
        ...cur,
        notice: "Marque ao menos 3 pontos no mapa e clique em Fechar polígono.",
      }));
      return;
    }
    if (s.tool === "group") {
      selectModulesInPolygon(s.draft);
      return;
    }
    if (s.tool === "obstacle" || s.drawKind === "restrita") {
      addObstacle(s.draft);
      return;
    }
    addArea(s.draft);
  }, [addArea, addObstacle, selectModulesInPolygon]);

  const moveModuleGroup = useCallback((
    ids: string[],
    origins: Array<{ id: string; x_m: number; y_m: number }>,
    dx_m: number,
    dy_m: number,
  ) => {
    markUndoPoint(true);
    setState((s) => {
      if (!s.layout) return s;
      const byId = new Map(origins.map((o) => [o.id, o]));
      const moved = s.layout.best.modules.map((m) => {
        const o = byId.get(m.id);
        if (!o || !ids.includes(m.id)) return m;
        return { ...m, x_m: o.x_m + dx_m, y_m: o.y_m + dy_m, source: "manual" as const };
      });
      const moving = moved.filter((m) => ids.includes(m.id));
      const others = moved.filter((m) => !ids.includes(m.id));
      if (groupOverlapsOthers(moving, others, s.module.gap_m)) return s;
      const checked = revalidateModules(s, moved);
      const installed = checked.length;
      return {
        ...s,
        layout: {
          ...s.layout,
          best: { ...s.layout.best, modules: checked },
          installed,
          missing: Math.max(0, s.module.quantity_target - installed),
          power_wp: installed * s.module.power_w,
          power_kwp: (installed * s.module.power_w) / 1000,
          occupied_area_m2: checked.reduce((sum, m) => sum + m.width_m * m.height_m, 0),
          status: installed === 0 ? "Impossível" : installed >= s.module.quantity_target ? "Aprovado" : "Parcial",
        },
      };
    });
  }, [revalidateModules]);

  const moveModule = useCallback((id: string, x_m: number, y_m: number) => {
    markUndoPoint(true);
    setState((s) => {
      if (!s.layout) return s;
      const current = s.layout.best.modules.find((m) => m.id === id);
      if (!current) return s;
      const candidate = { ...current, x_m, y_m, source: "manual" as const };
      if (overlapsAnyModule(candidate, s.layout.best.modules, s.module.gap_m)) return s;
      const moved = s.layout.best.modules.map((m) => (m.id === id ? candidate : m));
      const checked = revalidateModules(s, moved);
      const installed = checked.length;
      const layout: LayoutResult = {
        ...s.layout,
        best: { ...s.layout.best, modules: checked },
        installed,
        missing: Math.max(0, s.module.quantity_target - installed),
        power_wp: installed * s.module.power_w,
        power_kwp: (installed * s.module.power_w) / 1000,
        occupied_area_m2: checked.reduce((sum, m) => sum + m.width_m * m.height_m, 0),
        status: installed === 0 ? "Impossível" : installed >= s.module.quantity_target ? "Aprovado" : "Parcial",
      };
      return { ...s, layout };
    });
  }, [revalidateModules]);

  const rotateSelectedModules = useCallback(() => {
    markUndoPoint();
    setState((s) => {
      if (!s.layout) return s;
      const ids =
        s.selection.kind === "module-group"
          ? s.selection.ids ?? []
          : s.selection.kind === "module" && s.selection.id
            ? [s.selection.id]
            : [];
      if (!ids.length) return s;
      const idSet = new Set(ids);
      const group = s.layout.best.modules.filter((m) => idSet.has(m.id));
      if (!group.length) return s;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const m of group) {
        minX = Math.min(minX, m.x_m);
        minY = Math.min(minY, m.y_m);
        maxX = Math.max(maxX, m.x_m + m.width_m);
        maxY = Math.max(maxY, m.y_m + m.height_m);
      }
      const gcx = (minX + maxX) / 2;
      const gcy = (minY + maxY) / 2;
      const rotated = s.layout.best.modules.map((m) => {
        if (!idSet.has(m.id)) return m;
        const mx = m.x_m + m.width_m / 2;
        const my = m.y_m + m.height_m / 2;
        const dx = mx - gcx;
        const dy = my - gcy;
        const w = m.height_m;
        const h = m.width_m;
        return {
          ...m,
          width_m: w,
          height_m: h,
          x_m: gcx - dy - w / 2,
          y_m: gcy + dx - h / 2,
          orientation: (m.orientation === "paisagem" ? "retrato" : "paisagem") as ModuleOrientation,
          source: "manual" as const,
        };
      });
      const moving = rotated.filter((m) => idSet.has(m.id));
      const others = rotated.filter((m) => !idSet.has(m.id));
      if (groupOverlapsOthers(moving, others, s.module.gap_m)) {
        return { ...s, notice: "Não gira: encostaria em outro módulo." };
      }
      const checked = revalidateModules(s, rotated);
      const installed = checked.length;
      return {
        ...s,
        tool: "select",
        ruler: null,
        notice:
          ids.length > 1
            ? `${ids.length} módulos girados 90°. Arraste o bloco para reposicionar.`
            : "Módulo girado 90°. Arraste para reposicionar.",
        layout: {
          ...s.layout,
          best: { ...s.layout.best, modules: checked },
          installed,
          missing: Math.max(0, s.module.quantity_target - installed),
          power_wp: installed * s.module.power_w,
          power_kwp: (installed * s.module.power_w) / 1000,
          occupied_area_m2: checked.reduce((sum, m) => sum + m.width_m * m.height_m, 0),
          status: installed === 0 ? "Impossível" : installed >= s.module.quantity_target ? "Aprovado" : "Parcial",
        },
      };
    });
  }, [revalidateModules]);

  const deleteSelected = useCallback(() => {
    markUndoPoint();
    setState((s) => {
      const { selection } = s;
      if (selection.kind === "area" && selection.id) {
        return {
          ...s,
          areas: s.areas.filter((a) => a.id !== selection.id),
          selection: { kind: "none", id: null },
          layout: null,
        };
      }
      if (selection.kind === "obstacle" && selection.id) {
        return {
          ...s,
          obstacles: s.obstacles.filter((o) => o.id !== selection.id),
          selection: { kind: "none", id: null },
          layout: null,
        };
      }
      if (selection.kind === "launch" && selection.id) {
        const launches = s.launches.filter((z) => z.id !== selection.id);
        const modules = (s.layout?.best.modules ?? []).filter((m) => m.launch_id !== selection.id);
        return {
          ...s,
          launches,
          selection: { kind: "none", id: null },
          layout: modules.length || s.layout ? layoutFromLaunchModules(modules, s.module) : s.layout,
        };
      }
      if (selection.kind === "redact" && selection.id) {
        return {
          ...s,
          redacts: s.redacts.filter((r) => r.id !== selection.id),
          selection: { kind: "none", id: null },
        };
      }
      if (selection.kind === "module-group" && selection.ids?.length && s.layout) {
        const drop = new Set(selection.ids);
        const modules = s.layout.best.modules.filter((m) => !drop.has(m.id));
        const checked = revalidateModules(s, modules);
        const installed = checked.length;
        return {
          ...s,
          selection: { kind: "none", id: null },
          layout: {
            ...s.layout,
            best: { ...s.layout.best, modules: checked },
            installed,
            missing: Math.max(0, s.module.quantity_target - installed),
            power_wp: installed * s.module.power_w,
            power_kwp: (installed * s.module.power_w) / 1000,
            occupied_area_m2: checked.reduce((sum, m) => sum + m.width_m * m.height_m, 0),
            status: installed === 0 ? "Impossível" : installed >= s.module.quantity_target ? "Aprovado" : "Parcial",
          },
        };
      }
      if (selection.kind === "module" && selection.id && s.layout) {
        const modules = s.layout.best.modules.filter((m) => m.id !== selection.id);
        const checked = revalidateModules(s, modules);
        const installed = checked.length;
        return {
          ...s,
          selection: { kind: "none", id: null },
          layout: {
            ...s.layout,
            best: { ...s.layout.best, modules: checked },
            installed,
            missing: Math.max(0, s.module.quantity_target - installed),
            power_wp: installed * s.module.power_w,
            power_kwp: (installed * s.module.power_w) / 1000,
            occupied_area_m2: checked.reduce((sum, m) => sum + m.width_m * m.height_m, 0),
            status: installed === 0 ? "Impossível" : installed >= s.module.quantity_target ? "Aprovado" : "Parcial",
          },
        };
      }
      return s;
    });
  }, [revalidateModules]);

  const placeManualModule = useCallback((x_m: number, y_m: number) => {
    markUndoPoint();
    setState((s) => {
      if (!s.scale.calibrated) return { ...s, notice: "Calibre a escala antes de posicionar módulos." };
      const host = s.areas.find((a) => a.active && a.polygon_px.length >= 3 && pointInPolygon(
        [x_m / s.scale.meters_per_pixel, y_m / s.scale.meters_per_pixel],
        a.polygon_px,
      ));
      const m: PlacedModule = {
        id: uid("mod"),
        x_m,
        y_m,
        orientation: s.launch_orientation,
        width_m: s.launch_orientation === "paisagem" ? s.module.width_m : s.module.height_m,
        height_m: s.launch_orientation === "paisagem" ? s.module.height_m : s.module.width_m,
        rotation_deg: host ? roofGridDeg(host) : 0,
        source: "manual",
        violation: null,
        area_id: host?.id ?? null,
      };
      const current = s.layout?.best.modules ?? [];
      if (overlapsAnyModule(m, current, s.module.gap_m)) {
        return { ...s, notice: "O módulo não pode sobrepor outro." };
      }
      const modules = [...current, m];
      const checked = revalidateModules(s, modules);
      const installed = checked.length;
      const base = s.layout ?? {
        status: "Parcial" as const,
        installed: 0,
        requested: s.module.quantity_target,
        missing: s.module.quantity_target,
        power_wp: 0,
        power_kwp: 0,
        occupied_area_m2: 0,
        best: {
          orientation: "paisagem" as const,
          modules: [],
          score: 0,
          idle_area_m2: 0,
          grid_offset_m: 0,
          candidates_tested: 0,
          accepted_candidates: 0,
          rejected_outside: 0,
          rejected_obstacle: 0,
        },
        alternatives: [],
        usable_polygons_px: [],
        computed_at: Date.now(),
      };
      return {
        ...s,
        selection: { kind: "module", id: m.id },
        layout: {
          ...base,
          best: { ...base.best, modules: checked },
          installed,
          requested: s.module.quantity_target,
          missing: Math.max(0, s.module.quantity_target - installed),
          power_wp: installed * s.module.power_w,
          power_kwp: (installed * s.module.power_w) / 1000,
          occupied_area_m2: checked.reduce((sum, mod) => sum + mod.width_m * mod.height_m, 0),
          status: installed === 0 ? "Impossível" : installed >= s.module.quantity_target ? "Aprovado" : "Parcial",
        },
      };
    });
  }, [revalidateModules]);

  const calculate = useCallback(() => {
    markUndoPoint();
    setState((s) => {
      if (!s.image) return { ...s, notice: "Importe uma imagem primeiro." };
      if (!s.scale.calibrated) return { ...s, notice: "Calibre a escala antes de calcular." };
      if (!s.areas.some((a) => a.active && a.polygon_px.length >= 3)) {
        return { ...s, notice: "Desenhe ao menos uma área útil do telhado." };
      }
      return { ...s, busy: true, notice: "Gerando usina…" };
    });

    window.setTimeout(() => {
      setState((s) => {
        if (!s.scale.calibrated) return { ...s, busy: false };

        const finish = (partial: Partial<ProjectState> & { layout: LayoutResult; notice: string | null }) =>
          pruneEmptyLaunches({
            ...s,
            ...partial,
            busy: false,
            step: "layout",
            tool: "select",
          });

        const liveLaunchIds = new Set(
          (s.layout?.best.modules ?? []).map((m) => m.launch_id).filter((id): id is string => Boolean(id)),
        );
        const activeLaunches = (s.launches ?? []).filter((z) => liveLaunchIds.has(z.id));

        // Já há módulos: só revalida — não regenera por cima nem mantém lançamentos vazios.
        if ((s.layout?.best.modules.length ?? 0) > 0 && !activeLaunches.length) {
          const { kept } = cullOverlappingModules(s.layout!.best.modules);
          const checked = revalidateModules(s, kept);
          const ordered = sortModulesReadingOrder(checked);
          const installed = ordered.length;
          const layout = layoutFromLaunchModules(ordered, s.module);
          return finish({
            launches: [],
            layout: {
              ...layout,
              installed,
              missing: Math.max(0, layout.requested - installed),
              power_wp: installed * s.module.power_w,
              power_kwp: (installed * s.module.power_w) / 1000,
              status:
                installed === 0 ? "Impossível" : installed >= layout.requested ? "Aprovado" : "Parcial",
            },
            notice: `${installed} módulos · numeração atualizada na sequência do telhado.`,
          });
        }

        if (activeLaunches.length) {
          const result = packAllLaunches(activeLaunches, s.areas, s.obstacles, s.module, s.scale.meters_per_pixel);
          const checked = revalidateModules(s, result.layout.best.modules);
          const ordered = sortModulesReadingOrder(checked);
          const layout = layoutFromLaunchModules(ordered, s.module);
          const installed = ordered.length;
          return finish({
            launches: activeLaunches,
            layout: {
              ...layout,
              installed,
              missing: Math.max(0, layout.requested - installed),
              power_wp: installed * s.module.power_w,
              power_kwp: (installed * s.module.power_w) / 1000,
              status:
                installed === 0 ? "Impossível" : installed >= layout.requested ? "Aprovado" : "Parcial",
            },
            notice:
              result.error ??
              `${layout.status}: ${installed}/${layout.requested} módulos · numeração atualizada · ${((installed * s.module.power_w) / 1000).toFixed(2)} kWp`,
          });
        }

        const layout = generateLayout({
          areas: s.areas,
          obstacles: s.obstacles,
          module: s.module,
          meters_per_pixel: s.scale.meters_per_pixel,
          grid_step_m: s.grid_step_m,
        });
        const checked = revalidateModules(s, layout.best.modules);
        const ordered = sortModulesReadingOrder(checked);
        const installed = ordered.length;
        const fixed = {
          ...layout,
          best: { ...layout.best, modules: ordered },
          installed,
          missing: Math.max(0, layout.requested - installed),
          power_wp: installed * s.module.power_w,
          power_kwp: (installed * s.module.power_w) / 1000,
          status: (installed === 0
            ? "Impossível"
            : installed >= layout.requested
              ? "Aprovado"
              : "Parcial") as LayoutResult["status"],
        };
        const errors = layout.usable_polygons_px.filter((u) => u.error).map((u) => u.error);
        return finish({
          launches: [],
          layout: fixed,
          notice:
            errors[0] ??
            `${fixed.status}: ${fixed.installed}/${fixed.requested} módulos na usina · ${fixed.power_kwp.toFixed(2)} kWp`,
        });
      });
    }, 40);
  }, [markUndoPoint, pruneEmptyLaunches, revalidateModules]);

  const clearLayout = useCallback(() => {
    markUndoPoint();
    setState((s) => ({
      ...s,
      layout: null,
      launches: [],
      visualization: { ...s.visualization, outdated: true },
      notice: "Usina e lançamentos removidos.",
    }));
  }, [markUndoPoint]);

  const patchVisualization = useCallback((patch: Partial<VisualizationInfo>) => {
    setState((s) => ({ ...s, visualization: { ...s.visualization, ...patch } }));
  }, []);

  const readEarthFooter = useCallback(async () => {
    const src = stateRef.current.image?.original_src || stateRef.current.image?.src;
    if (!src) {
      setState((s) => ({ ...s, notice: "Importe uma captura do Google Earth primeiro." }));
      return null;
    }
    setState((s) => ({ ...s, notice: "Lendo o rodapé do Google Earth…", busy: true }));
    try {
      const data = await srcToBase64(src);
      if (!data) throw new Error("Não foi possível ler a imagem.");
      const georef = normalizeEarthGeoref(await requestGeoref(data));
      setState((s) => ({
        ...s,
        busy: false,
        georef: {
          ...georef,
          // mantém endereço antigo até o reverse completar
          endereco: s.georef.endereco,
          bairro: s.georef.bairro,
          cidade: s.georef.cidade,
          address_display: s.georef.address_display,
        },
        scale_input_m: georef.scale_bar_m ?? s.scale_input_m,
        persist: { ...s.persist, dirty: true },
        notice:
          georef.confidence === "none"
            ? "Norte para cima. Não deu para ler o rodapé — deixe a barra inferior (coordenadas e escala) visível na captura."
            : georef.confidence === "low"
              ? `Rodapé parcial: ${(georef as { raw_text?: string }).raw_text || "texto fraco"}. Se as coordenadas faltarem, recorte menos a barra inferior.`
              : `${formatGeoRef(georef)}. Local preenchido.`,
      }));
      if (georef.latitude_deg != null && georef.longitude_deg != null) {
        const place = await resolveAddress({
          lat: georef.latitude_deg,
          lon: georef.longitude_deg,
          overwriteEtiqueta: false,
        });
        if (place) {
          setState((s) => ({
            ...s,
            notice: `${formatGeoRef(s.georef)}. ${place.display}`,
          }));
        }
      }
      return georef;
    } catch (err) {
      setState((s) => ({
        ...s,
        busy: false,
        georef: { ...EMPTY_GEOREF, north_up: true },
        notice: err instanceof Error ? err.message : "Falha ao ler o rodapé.",
      }));
      return null;
    }
  }, [resolveAddress]);

  const restoreVisualizationOriginal = useCallback(() => {
    setState((s) => ({
      ...s,
      visualization: { ...s.visualization, use_enhanced: false, compare_original: true },
      notice: "Imagem original exibida. As versões aprimoradas permanecem no histórico visual.",
    }));
  }, []);

  const enhancePresentation = useCallback(async () => {
    const s = stateRef.current;
    if (!s.image) {
      setState((cur) => ({ ...cur, notice: "Importe uma imagem primeiro." }));
      return;
    }
    setState((cur) => ({
      ...cur,
      visualization: { ...cur.visualization, status: "running" },
      notice: "Melhorando a apresentação visual…",
    }));
    try {
      const imageData = await srcToBase64(s.image.src);
      if (!imageData) throw new Error("Não foi possível ler a imagem atual.");
      const mpp = s.scale.meters_per_pixel || 1;
      const modules = (s.layout?.best.modules ?? []).map((m, i) => {
        const [x, y] = mToPx([m.x_m, m.y_m], mpp);
        const w = m.width_m / mpp;
        const h = m.height_m / mpp;
        return {
          id: m.id,
          row: 1,
          column: i + 1,
          polygon_px: modulePolygon({
            x_m: x,
            y_m: y,
            width_m: w,
            height_m: h,
            rotation_deg: m.rotation_deg ?? 0,
          }).map(([px, py]) => ({ x: px, y: py })),
          rotation_deg: (m.rotation_deg ?? 0) + (m.orientation === "paisagem" ? 90 : 0),
          power_w: s.module.power_w,
          status: m.violation ? "invalid" : "valid",
        };
      });
      const result = await requestVisualization({
        project_id: s.persist.last_saved_id || "rascunho",
        mode: s.visualization.mode,
        image: { data: imageData },
        modules,
        obstacles: s.obstacles.map((o) => ({
          id: o.id,
          name: o.name,
          polygon_px: o.polygon_px.map(([x, y]) => ({ x, y })),
          visible: true,
        })),
        show_modules: s.visualization.show_modules,
        show_obstacles: s.visualization.show_obstacles,
        include_warning: true,
      });
      setState((cur) => ({
        ...cur,
        visualization: {
          ...cur.visualization,
          id: uid("viz"),
          status: result.status,
          enhanced_src: result.enhanced_image_url ?? null,
          composite_src: result.composite_image_url ?? null,
          technical_src: result.technical_image_url ?? null,
          warnings: result.warnings ?? [],
          geometry_preserved: result.geometry_preserved !== false,
          layout_reapplied: result.layout_reapplied !== false,
          use_enhanced: Boolean(result.enhanced_image_url) && result.status === "completed",
          compare_original: false,
          outdated: false,
        },
        notice:
          result.status === "completed"
            ? modules.length
              ? `Apresentação gerada. ${modules.length} módulos reaplicados · ${(modules.length * s.module.power_w / 1000).toFixed(2)} kWp.`
              : "Imagem aprimorada sem layout técnico confirmado."
            : result.warnings?.[0] ?? "Melhoria visual indisponível. O layout técnico permanece.",
      }));
    } catch (err) {
      setState((cur) => ({
        ...cur,
        visualization: { ...cur.visualization, status: "fallback" },
        notice: err instanceof Error ? err.message : "Falha na melhoria visual. A imagem original continua disponível.",
      }));
    }
  }, []);

  const setCrop = useCallback((crop: Omit<RectPx, "id"> | null) => {
    setState((s) => ({ ...s, crop }));
  }, []);

  const addRedact = useCallback((rect: Omit<RectPx, "id">) => {
    if (rect.w < 8 || rect.h < 8) return;
    markUndoPoint();
    const item: RectPx = { ...rect, id: uid("hide") };
    setState((s) => ({
      ...s,
      redacts: [...s.redacts, item],
      selection: { kind: "redact", id: item.id },
      notice: "Faixa oculta marcada. Aplique as alterações para gravar na imagem.",
    }));
  }, []);

  const updateRedact = useCallback((id: string, rect: Omit<RectPx, "id">) => {
    setState((s) => ({
      ...s,
      redacts: s.redacts.map((r) => (r.id === id ? { ...r, ...rect } : r)),
    }));
  }, []);

  const suggestMapFrame = useCallback(() => {
    markUndoPoint();
    setState((s) => {
      if (!s.image) return s;
      return {
        ...s,
        crop: suggestMapCrop(s.image.width_px, s.image.height_px),
        tool: "crop",
        notice: "Moldura sugerida. Ajuste as alças e aplique o recorte.",
      };
    });
  }, []);

  const suggestHideChrome = useCallback(() => {
    markUndoPoint();
    setState((s) => {
      if (!s.image) return s;
      return {
        ...s,
        redacts: suggestChromeRedacts(s.image.width_px, s.image.height_px),
        tool: "redact",
        notice: "Barras e ícones do mapa marcados para ocultar. Aplique para gravar.",
      };
    });
  }, [markUndoPoint]);

  const remapAfterShift = useCallback((s: ProjectState, dx: number, dy: number): ProjectState => {
    const shift = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
    const mpp = s.scale.meters_per_pixel;
    return {
      ...s,
      areas: s.areas.map((a) => ({ ...a, polygon_px: a.polygon_px.map(shift) })),
      obstacles: s.obstacles.map((o) => ({ ...o, polygon_px: o.polygon_px.map(shift) })),
      scaleDraft: s.scaleDraft.map(shift),
      headingDraft: (s.headingDraft ?? []).map(shift),
      ruler: s.ruler ? { a: shift(s.ruler.a), b: shift(s.ruler.b) } : null,
      scale: {
        ...s.scale,
        reference: s.scale.reference
          ? {
              ...s.scale.reference,
              point_a: shift(s.scale.reference.point_a),
              point_b: shift(s.scale.reference.point_b),
            }
          : null,
        heading: s.scale.heading
          ? {
              ...s.scale.heading,
              point_a: shift(s.scale.heading.point_a),
              point_b: shift(s.scale.heading.point_b),
            }
          : null,
      },
      layout: s.layout && mpp > 0
        ? {
            ...s.layout,
            best: {
              ...s.layout.best,
              modules: s.layout.best.modules.map((m) => ({
                ...m,
                x_m: m.x_m + dx * mpp,
                y_m: m.y_m + dy * mpp,
              })),
            },
            usable_polygons_px: s.layout.usable_polygons_px.map((u) => ({
              ...u,
              polygon_px: u.polygon_px.map(shift),
            })),
          }
        : s.layout,
    };
  }, []);

  const scaleStatePixels = useCallback((s: ProjectState, factor: number): ProjectState => {
    if (!Number.isFinite(factor) || Math.abs(factor - 1) < 1e-6) return s;
    const pt = (p: Pt): Pt => [p[0] * factor, p[1] * factor];
    const mpp = s.scale.meters_per_pixel;
    return {
      ...s,
      draft: s.draft.map(pt),
      scaleDraft: s.scaleDraft.map(pt),
      headingDraft: (s.headingDraft ?? []).map(pt),
      ruler: s.ruler ? { a: pt(s.ruler.a), b: pt(s.ruler.b) } : null,
      areas: s.areas.map((a) => ({ ...a, polygon_px: a.polygon_px.map(pt) })),
      obstacles: s.obstacles.map((o) => ({ ...o, polygon_px: o.polygon_px.map(pt) })),
      launches: s.launches.map((z) => ({ ...z, polygon_px: z.polygon_px.map(pt) })),
      scale: {
        ...s.scale,
        meters_per_pixel: s.scale.reference && mpp > 0 ? mpp / factor : s.scale.meters_per_pixel,
        pixels_per_meter:
          s.scale.reference && s.scale.pixels_per_meter > 0 ? s.scale.pixels_per_meter * factor : s.scale.pixels_per_meter,
        reference: s.scale.reference
          ? {
              ...s.scale.reference,
              point_a: pt(s.scale.reference.point_a),
              point_b: pt(s.scale.reference.point_b),
            }
          : null,
        heading: s.scale.heading
          ? {
              ...s.scale.heading,
              point_a: pt(s.scale.heading.point_a),
              point_b: pt(s.scale.heading.point_b),
            }
          : null,
      },
    };
  }, []);

  const applyHdTreatment = useCallback(async (working: ImageInfo): Promise<ImageInfo> => {
    if (working.hd_applied) return working;
    const data = await srcToBase64(working.src);
    if (data) {
      try {
        const remote = await requestEnhanceHd(data);
        if (remote.ok && remote.url) {
          const img = await readImageFile(remote.url, working.file.replace(/(-edit|-hd)?\.[^.]+$/, "") + "-hd.jpg");
          return {
            ...img,
            original_src: working.original_src,
            original_width_px: working.original_width_px,
            original_height_px: working.original_height_px,
            offset_px: working.offset_px,
            hd_applied: true,
          };
        }
      } catch {
        /* cai no tratamento local */
      }
    }
    return enhanceHdCanvas(working);
  }, []);

  const finishImageEdit = useCallback(async (opts: { enhance: boolean; goToScale: boolean }) => {
    const snapshot = stateRef.current;
    if (!snapshot.image) return;
    markUndoPoint();
    setState((s) => ({
      ...s,
      busy: true,
      notice: opts.enhance
        ? "Aplicando melhoria 512–768…"
        : snapshot.crop || snapshot.redacts.length
          ? "Aplicando recorte…"
          : "Preparando imagem…",
    }));
    try {
      let working = snapshot.image;
      let dx = 0;
      let dy = 0;
      if (snapshot.crop || snapshot.redacts.length) {
        working = await composeEditedImage(snapshot.image, snapshot.crop, snapshot.redacts);
        dx = snapshot.crop ? -snapshot.crop.x : 0;
        dy = snapshot.crop ? -snapshot.crop.y : 0;
      }
      const before = working;
      if (opts.enhance) {
        working = await applyHdTreatment(working);
      }
      const factor = before.width_px > 0 ? working.width_px / before.width_px : 1;
      setState((s) => {
        const shifted = remapAfterShift({ ...s, image: working, crop: null, redacts: [] }, dx, dy);
        const scaled = factor !== 1 ? scaleStatePixels(shifted, factor) : shifted;
        return {
          ...scaled,
          image: working,
          crop: null,
          redacts: [],
          busy: false,
          selection: { kind: "none", id: null },
          step: opts.goToScale ? "scale" : s.step,
          tool: opts.goToScale ? "scale" : s.tool === "crop" || s.tool === "redact" ? "pan" : s.tool,
          notice: opts.enhance && working.hd_applied
            ? `Imagem melhorada ${working.width_px} × ${working.height_px} px (lado maior 512–768). Original preservado.`
            : `Recorte aplicado: ${working.width_px} × ${working.height_px} px. Melhoria é opcional.`,
        };
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        busy: false,
        notice: err instanceof Error ? err.message : "Falha ao editar a imagem.",
      }));
    }
  }, [applyHdTreatment, markUndoPoint, remapAfterShift, scaleStatePixels]);

  const applyImageEdit = useCallback(async () => {
    await finishImageEdit({ enhance: false, goToScale: false });
  }, [finishImageEdit]);

  const applyEnhanceImage = useCallback(async () => {
    await finishImageEdit({ enhance: true, goToScale: false });
  }, [finishImageEdit]);

  const applyHdAndCalibrate = useCallback(async () => {
    await finishImageEdit({ enhance: true, goToScale: true });
  }, [finishImageEdit]);

  const applyLoaded = useCallback(async (
    loaded: { exists: boolean; project?: ReturnType<typeof serializeProject>; imageUrl?: string | null; originalUrl?: string | null },
    notice: string,
  ) => {
    if (!loaded.exists || !loaded.project || !loaded.imageUrl || !loaded.project.image) {
      return false;
    }
    const p = loaded.project;
    const meta = p.image;
    if (!meta) return false;
    const stamp = Date.now();
    const src = `${loaded.imageUrl}${loaded.imageUrl.includes("?") ? "&" : "?"}t=${stamp}`;
    const original = loaded.originalUrl
      ? `${loaded.originalUrl}${loaded.originalUrl.includes("?") ? "&" : "?"}t=${stamp}`
      : src;
    const image = await readImageFile(src, meta.file);
    image.original_src = original;
    image.original_width_px = meta.original_width_px;
    image.original_height_px = meta.original_height_px;
    image.offset_px = meta.offset_px;
    image.hd_applied = Boolean(meta.hd_applied);
    clearHistory();
    const georef = p.georef ? { ...EMPTY_GEOREF, ...p.georef, north_up: true } : { ...EMPTY_GEOREF };
    // Revisão: carrega etiqueta do JSON. Sem etiqueta / projeto novo → cliente null/vazio.
    const etiqueta = hydrateEtiqueta(p.etiqueta ?? null);
    setState({
      ...initialState(),
      image,
      scale: { ...EMPTY_SCALE, ...p.scale, heading: p.scale.heading ?? null, check: p.scale.check ?? null },
      scaleDraft: p.scaleDraft,
      headingDraft: p.scale.heading ? [p.scale.heading.point_a, p.scale.heading.point_b] : [],
      scale_input_m: p.scale_input_m ?? 10,
      ruler: p.ruler,
      crop: p.crop,
      redacts: p.redacts,
      areas: p.areas,
      obstacles: p.obstacles,
      launches: p.launches ?? [],
      launch_mode: p.launch_mode ?? "mista",
      launch_orientation: p.launch_orientation ?? "paisagem",
      module: p.module,
      layout: p.layout,
      georef,
      etiqueta,
      step: p.step === "import" ? "edit" : p.step,
      tool: p.tool,
      drawKind: p.drawKind,
      grid_step_m: p.grid_step_m,
      persist: {
        ...EMPTY_PERSIST,
        name: p.name,
        last_temp_at: p.savedAt,
        last_saved_id: p.id ?? null,
        last_saved_at: p.id ? p.savedAt : null,
        dirty: false,
      },
      notice,
    });
    if (
      georef.latitude_deg != null &&
      georef.longitude_deg != null &&
      !georef.endereco &&
      !georef.cidade
    ) {
      void resolveAddressRef.current?.({
        lat: georef.latitude_deg,
        lon: georef.longitude_deg,
        overwriteEtiqueta: false,
      });
    }
    return true;
  }, [clearHistory]);

  const restoreSession = useCallback(async () => {
    const gen = sessionGenRef.current;
    try {
      const loaded = await loadTemp();
      if (gen !== sessionGenRef.current) return;
      const ok = await applyLoaded(loaded, "Rascunho recuperado de .temp. Nada foi perdido.");
      if (gen !== sessionGenRef.current) return;
      readyRef.current = true;
      if (!ok) {
        setState((s) => ({
          ...s,
          notice: "Nenhum rascunho em .temp. Solte uma imagem — ela será gravada na hora.",
        }));
      }
    } catch {
      if (gen !== sessionGenRef.current) return;
      readyRef.current = true;
      setState((s) => ({
        ...s,
        notice: "Não foi possível ler .temp. Importe a imagem novamente.",
      }));
    }
  }, [applyLoaded]);

  const saveProject = useCallback(async (name?: string) => {
    const snapshot = state;
    if (!snapshot.image) {
      setState((s) => ({ ...s, notice: "Importe uma imagem antes de salvar." }));
      return;
    }
    const projectName = (name || snapshot.persist.name || "Projeto").trim();
    try {
      setState((s) => ({ ...s, busy: true, notice: "Salvando projeto…" }));
      const imageData = await srcToBase64(snapshot.image.src);
      const originalData =
        snapshot.image.original_src && snapshot.image.original_src !== snapshot.image.src
          ? await srcToBase64(snapshot.image.original_src)
          : imageData;
      const result = await saveNamedProject(
        projectName,
        serializeProject(snapshot, projectName),
        imageData,
        originalData,
      );
      setState((s) => ({
        ...s,
        busy: false,
        persist: {
          ...s.persist,
          name: projectName,
          dirty: false,
          last_saved_at: result.savedAt,
          last_saved_id: result.id,
          last_saved_path: result.folder,
          last_pictures_path: result.picturesPath,
          last_temp_at: result.savedAt,
        },
        notice: result.picturesPath
          ? `Salvo em projetos e em Imagens/PlanoSol (${result.id}).`
          : `Salvo em projetos/${result.id}.`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        busy: false,
        notice: err instanceof Error ? err.message : "Falha ao salvar o projeto.",
      }));
    }
  }, [state]);

  const newProject = useCallback(async () => {
    try {
      sessionGenRef.current += 1;
      const archived = await archiveTemp();
      clearHistory();
      setState({
        ...initialState(),
        launch_orientation: defaultsRef.current.launch_orientation,
        module: { ...DEFAULT_MODULE, gap_m: defaultsRef.current.module_gap_m },
        notice: archived.archived
          ? `Rascunho anterior guardado em .temp/historico/${archived.id}. Pode importar de novo sem perder o que já fez.`
          : "Novo projeto. Solte uma imagem — ela será gravada em .temp.",
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        notice: err instanceof Error ? err.message : "Falha ao arquivar o rascunho.",
      }));
    }
  }, [clearHistory]);

  const openSaved = useCallback(async (scope: "projetos" | "historico", id: string) => {
    try {
      setState((s) => ({ ...s, busy: true, notice: `Abrindo ${scope === "historico" ? "histórico" : "projeto"} «${id}»…` }));
      const loaded = await loadSaved(scope, id);
      if (!loaded.exists || !loaded.project) {
        setState((s) => ({ ...s, busy: false, notice: `Item «${id}» não encontrado em ${scope}.` }));
        return;
      }
      if (!loaded.imageUrl || !loaded.project.image) {
        setState((s) => ({
          ...s,
          busy: false,
          notice: `«${loaded.project?.name ?? id}» sem imagem gravada. Não dá para reabrir.`,
        }));
        return;
      }
      try {
        const ok = await applyLoaded(
          loaded,
          scope === "projetos"
            ? `Projeto «${loaded.project.name ?? id}» aberto.`
            : `Histórico «${loaded.project.name || id}» restaurado (${id}).`,
        );
        if (!ok) {
          setState((s) => ({ ...s, busy: false, notice: "Não foi possível montar esse projeto." }));
          return;
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          busy: false,
          notice: err instanceof Error ? err.message : "Falha ao carregar a imagem do projeto.",
        }));
        return;
      }
      // Copia para .temp para Continuar rascunho e autosave
      try {
        const snap = stateRef.current;
        if (snap.image) {
          const imageData = await srcToBase64(snap.image.src);
          const originalData =
            snap.image.original_src && snap.image.original_src !== snap.image.src
              ? await srcToBase64(snap.image.original_src)
              : imageData;
          await saveTemp(serializeProject(snap, snap.persist.name || loaded.project.name || id), imageData, originalData);
        }
      } catch {
        /* abertura já ok; temp é bônus */
      }
      setState((s) => ({ ...s, busy: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        busy: false,
        notice: err instanceof Error ? err.message : "Falha ao abrir o projeto.",
      }));
    }
  }, [applyLoaded]);

  const patchGeoref = useCallback((patch: Partial<import("../types").GeoRef>) => {
    let shouldResolve = false;
    let lat: number | null = null;
    let lon: number | null = null;
    setState((s) => {
      const georef = { ...s.georef, ...patch, north_up: true, source: "google_earth_web" as const };
      if (georef.latitude_deg != null && georef.longitude_deg != null) georef.confidence = "high";
      else if (georef.scale_bar_m != null || georef.camera_m != null || georef.elevation_m != null) {
        georef.confidence = georef.confidence === "high" ? "high" : "low";
      }
      const coordsChanged =
        (patch.latitude_deg != null && patch.latitude_deg !== s.georef.latitude_deg) ||
        (patch.longitude_deg != null && patch.longitude_deg !== s.georef.longitude_deg);
      if (
        coordsChanged &&
        georef.latitude_deg != null &&
        georef.longitude_deg != null &&
        Number.isFinite(georef.latitude_deg) &&
        Number.isFinite(georef.longitude_deg)
      ) {
        shouldResolve = true;
        lat = georef.latitude_deg;
        lon = georef.longitude_deg;
        // limpa endereço antigo até o reverse completar
        georef.endereco = null;
        georef.bairro = null;
        georef.cidade = null;
        georef.address_display = null;
      }
      return {
        ...s,
        georef,
        scale_input_m: patch.scale_bar_m != null && patch.scale_bar_m > 0 ? patch.scale_bar_m : s.scale_input_m,
        persist: { ...s.persist, dirty: true },
      };
    });
    if (shouldResolve && lat != null && lon != null) {
      void resolveAddress({ lat, lon, overwriteEtiqueta: false });
    }
  }, [resolveAddress]);

  const updateEtiqueta = useCallback((patch: Partial<Etiqueta>) => {
    setState((s) => ({
      ...s,
      etiqueta: { ...freshEtiqueta(), ...s.etiqueta, ...patch },
      persist: { ...s.persist, dirty: true },
    }));
  }, []);

  const setProjectName = useCallback((name: string) => {
    setState((s) => ({ ...s, persist: { ...s.persist, name, dirty: true } }));
  }, []);

  const saveAppDefaults = useCallback(async (next: AppDefaults) => {
    const saved = await saveDefaults(next);
    setDefaults(saved);
    defaultsRef.current = saved;
    setState((s) => ({
      ...s,
      launch_orientation: saved.launch_orientation,
      module: { ...s.module, gap_m: saved.module_gap_m },
      areas: s.areas.map((a) => ({ ...a, margin_m: saved.area_margin_m })),
      notice: "Padrões gravados em defaults.json. Recuo das áreas já desenhadas atualizado.",
    }));
  }, []);

  const restoreOriginalImage = useCallback(async () => {
    const snapshot = state;
    if (!snapshot.image) return;
    setState((s) => ({ ...s, busy: true, notice: "Restaurando imagem original…" }));
    try {
      const original = await new Promise<ImageInfo>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            file: snapshot.image!.file.replace(/-edit\.png$/, ".png"),
            width_px: img.naturalWidth,
            height_px: img.naturalHeight,
            src: snapshot.image!.original_src,
            original_src: snapshot.image!.original_src,
            original_width_px: snapshot.image!.original_width_px,
            original_height_px: snapshot.image!.original_height_px,
            offset_px: [0, 0],
            hd_applied: false,
          });
        };
        img.onerror = () => reject(new Error("Não foi possível restaurar o original."));
        img.src = snapshot.image!.original_src;
      });
      const dx = snapshot.image.offset_px[0];
      const dy = snapshot.image.offset_px[1];
      setState((s) => {
        const shifted = remapAfterShift({ ...s, image: original }, dx, dy);
        return {
          ...shifted,
          crop: suggestMapCrop(original.width_px, original.height_px),
          redacts: [],
          busy: false,
          notice: "Imagem original restaurada.",
        };
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        busy: false,
        notice: err instanceof Error ? err.message : "Falha ao restaurar.",
      }));
    }
  }, [remapAfterShift, state]);

  const api = useMemo<ProjectApi>(
    () => ({
      state,
      setStep,
      setTool,
      setNotice,
      loadImage,
      loadFile,
      loadDemo,
      loadEarthSample,
      applyTwoPointScale,
      applyHeading,
      setHeadingDraft,
      clearHeading,
      setScaleInputM,
      verifyScale,
      clearScale,
      applyDirectScale,
      verifyConference,
      setDraft,
      setScaleDraft,
      setRuler,
      addArea,
      addObstacle,
      finishOpenDraft,
      addLaunch,
      setDrawKind,
      setLaunchMode,
      setLaunchOrientation,
      selectModulesInPolygon,
      moveModuleGroup,
      updateArea,
      updateObstacle,
      updateLaunch,
      deleteArea,
      deleteObstacle,
      deleteLaunch,
      setModule,
      applyPiengBridge,
      setGridStep,
      select,
      refreshValidity,
      moveVertex,
      moveModule,
      rotateSelectedModules,
      deleteSelected,
      placeManualModule,
      calculate,
      clearLayout,
      setCrop,
      addRedact,
      updateRedact,
      suggestMapFrame,
      suggestHideChrome,
      applyImageEdit,
      applyEnhanceImage,
      applyHdAndCalibrate,
      restoreOriginalImage,
      restoreSession,
      saveProject,
      newProject,
      openSaved,
      setProjectName,
      defaults,
      saveAppDefaults,
      enhancePresentation,
      patchVisualization,
      patchGeoref,
      resolveAddress,
      restoreVisualizationOriginal,
      updateEtiqueta,
      readEarthFooter,
      markUndoPoint,
      endUndoGesture,
      undo,
      redo,
      canUndo: historyLen > 0,
      canRedo: redoLen > 0,
    }),
    [
      state,
      historyLen,
      redoLen,
      setStep,
      setTool,
      setNotice,
      loadImage,
      loadFile,
      loadDemo,
      loadEarthSample,
      applyTwoPointScale,
      applyHeading,
      setHeadingDraft,
      clearHeading,
      setScaleInputM,
      verifyScale,
      clearScale,
      applyDirectScale,
      verifyConference,
      setDraft,
      setScaleDraft,
      setRuler,
      addArea,
      addObstacle,
      finishOpenDraft,
      addLaunch,
      setDrawKind,
      setLaunchMode,
      setLaunchOrientation,
      selectModulesInPolygon,
      moveModuleGroup,
      updateArea,
      updateObstacle,
      updateLaunch,
      deleteArea,
      deleteObstacle,
      deleteLaunch,
      setModule,
      applyPiengBridge,
      setGridStep,
      select,
      refreshValidity,
      moveVertex,
      moveModule,
      rotateSelectedModules,
      deleteSelected,
      placeManualModule,
      calculate,
      clearLayout,
      setCrop,
      addRedact,
      updateRedact,
      suggestMapFrame,
      suggestHideChrome,
      applyImageEdit,
      applyEnhanceImage,
      applyHdAndCalibrate,
      restoreOriginalImage,
      restoreSession,
      saveProject,
      newProject,
      openSaved,
      setProjectName,
      defaults,
      saveAppDefaults,
      enhancePresentation,
      patchVisualization,
      restoreVisualizationOriginal,
      patchGeoref,
      resolveAddress,
      updateEtiqueta,
      readEarthFooter,
      markUndoPoint,
      endUndoGesture,
      undo,
      redo,
    ],
  );

  useEffect(() => {
    if (!readyRef.current) return;
    if (!state.image) return;
    const timer = window.setTimeout(() => {
      const snap = stateRef.current;
      if (!snap.image) return;
      void (async () => {
        try {
          const imageData = await srcToBase64(snap.image!.src);
          const originalData =
            snap.image!.original_src && snap.image!.original_src !== snap.image!.src
              ? await srcToBase64(snap.image!.original_src)
              : imageData;
          const result = await saveTemp(serializeProject(snap, snap.persist.name), imageData, originalData);
          setState((s) => ({
            ...s,
            persist: { ...s.persist, last_temp_at: result.savedAt, dirty: true },
          }));
        } catch {
          /* o rascunho tenta de novo na próxima alteração */
        }
      })();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    state.image,
    state.scale,
    state.areas,
    state.obstacles,
    state.launches,
    state.launch_mode,
    state.crop,
    state.redacts,
    state.module,
    state.layout,
    state.step,
    state.drawKind,
    state.georef,
    state.etiqueta,
  ]);

  return <ProjectContext.Provider value={api}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectApi {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject deve estar dentro de ProjectProvider");
  return ctx;
}
