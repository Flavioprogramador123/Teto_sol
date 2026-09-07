import { useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "../state/ProjectContext";
import type { ModuleOrientation, Pt, ProjectState, RoofArea } from "../types";
import { barFrom, lineAzimuthDeg, matchModuleSide, mToPx, offsetBar } from "../engine/scale";
import { handlePoints, hitCropHandle, normalizeRect, resizeRect, type CropHandle } from "../engine/imageEdit";
import { packOrientedPolygon } from "../engine/launch";
import { modulePolygon, pointInModule, pointInPolygon, polygonsTouchOrOverlap } from "../engine/geometry";
import { roofGridDeg, rotateAround } from "../engine/roofPlane";
import painelSrc from "../../img/modulo.png";
import { StageTools } from "./StageTools";

/** Desvio da grade (azimute − 90°) no ponto / área sob o cursor. */
function launchGridDegAt(p: Pt, state: ProjectState): number {
  const host = state.areas.find(
    (a) => a.active && a.polygon_px.length >= 3 && pointInPolygon(p, a.polygon_px),
  );
  if (host) return roofGridDeg(host);
  const first = state.areas.find((a) => a.active && a.polygon_px.length >= 3) as RoofArea | undefined;
  if (first) return roofGridDeg(first);
  if (state.scale.heading) {
    let d = state.scale.heading.azimuth_deg - 90;
    d = ((d % 360) + 360) % 360;
    if (d > 180) d -= 360;
    return d;
  }
  return 0;
}

/** Retângulo de lançamento alinhado ao desvio de azimute (cantos no espaço da imagem). */
function orientedLaunchRect(from: Pt, to: Pt, gridDeg: number): { corners: Pt[]; w: number; h: number } {
  const toLocal = (pt: Pt): Pt => rotateAround(pt, from, -gridDeg);
  const toWorld = (pt: Pt): Pt => rotateAround(pt, from, gridDeg);
  const a = toLocal(from);
  const b = toLocal(to);
  const minX = Math.min(a[0], b[0]);
  const maxX = Math.max(a[0], b[0]);
  const minY = Math.min(a[1], b[1]);
  const maxY = Math.max(a[1], b[1]);
  return {
    w: maxX - minX,
    h: maxY - minY,
    corners: [
      toWorld([minX, minY]),
      toWorld([maxX, minY]),
      toWorld([maxX, maxY]),
      toWorld([minX, maxY]),
    ],
  };
}

function ModuleSprite({
  x,
  y,
  w,
  h,
  orientation,
  rotation = 0,
  selected,
  violation,
  ui,
  number,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: ModuleOrientation;
  rotation?: number;
  selected: boolean;
  violation: boolean;
  ui: number;
  number?: number;
}) {
  const landscape = orientation === "paisagem" || w > h;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotation}) translate(${-w / 2} ${-h / 2})`}>
      {landscape ? (
        <g transform={`translate(${w / 2} ${h / 2}) rotate(90)`}>
          <image
            href={painelSrc}
            x={-h / 2}
            y={-w / 2}
            width={h}
            height={w}
            preserveAspectRatio="none"
          />
        </g>
      ) : (
        <image
          href={painelSrc}
          x={0}
          y={0}
          width={w}
          height={h}
          preserveAspectRatio="none"
        />
      )}
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill={violation ? "rgba(224,90,79,0.38)" : selected ? "rgba(243, 193, 91, 0.18)" : "none"}
        stroke={selected ? "#f3c15b" : violation ? "#ff8a80" : "rgba(26,20,8,0.55)"}
        strokeWidth={(selected || violation ? 2.2 : 0.8) * ui}
      />
      {number != null && (
        <text
          x={w / 2}
          y={h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff8e6"
          stroke="#1a1408"
          strokeWidth={2.2 * ui}
          paintOrder="stroke"
          fontSize={Math.max(8 * ui, Math.min(w, h) * 0.34)}
          fontWeight={700}
          style={{ pointerEvents: "none" }}
        >
          {number}
        </text>
      )}
    </g>
  );
}

function ScaleDimension({
  a,
  b,
  color,
  label,
  ui,
}: {
  a: Pt;
  b: Pt;
  color: string;
  label: string;
  ui: number;
}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const hx = (-dy / len) * 7 * ui;
  const hy = (dx / len) * 7 * ui;
  const lx = (-dy / len) * 14 * ui;
  const ly = (dx / len) * 14 * ui;
  return (
    <g>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={2 * ui} />
      <line x1={a[0] - hx} y1={a[1] - hy} x2={a[0] + hx} y2={a[1] + hy} stroke={color} strokeWidth={1.6 * ui} />
      <line x1={b[0] - hx} y1={b[1] - hy} x2={b[0] + hx} y2={b[1] + hy} stroke={color} strokeWidth={1.6 * ui} />
      <text
        x={(a[0] + b[0]) / 2 + lx}
        y={(a[1] + b[1]) / 2 + ly}
        fill={color}
        fontSize={12 * ui}
        fontWeight={700}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

export function CanvasBoard() {
  const {
    state,
    setTool,
    setDraft,
    setScaleDraft,
    setRuler,
    addLaunch,
    select,
    refreshValidity,
    finishOpenDraft,
    moveModuleGroup,
    moveVertex,
    moveModule,
    rotateSelectedModules,
    deleteSelected,
    placeManualModule,
    applyTwoPointScale,
    applyHeading,
    endUndoGesture,
    setHeadingDraft,
    setCrop,
    addRedact,
    updateRedact,
    applyImageEdit,
    defaults,
    setNotice,
    patchVisualization,
  } = useProject();

  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ zoom: 1, x: 20, y: 20 });
  const [fit, setFit] = useState(0.4);
  const [panning, setPanning] = useState(false);
  const scaleMeters = state.scale_input_m > 0 ? state.scale_input_m : 10;
  const [redactDraft, setRedactDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [overScaleHandle, setOverScaleHandle] = useState<number | null>(null);
  const [holdingScale, setHoldingScale] = useState(false);
  const [overVertex, setOverVertex] = useState<{ id: string; index: number } | null>(null);
  const [holdingVertex, setHoldingVertex] = useState(false);
  const [moduleTape, setModuleTape] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    width_m: number;
    height_m: number;
  } | null>(null);
  useEffect(() => {
    if (state.tool !== "ruler") setModuleTape(null);
  }, [state.tool]);
  const [showAreas, setShowAreas] = useState(() => localStorage.getItem("pepilene-show-areas") !== "0");
  const showModuleNumbers = Boolean(state.visualization?.show_module_numbers);
  useEffect(() => {
    // Preferência local → estado do projeto (uma vez, se ainda não ligado)
    if (localStorage.getItem("pepilene-show-mod-nums") === "1" && !state.visualization?.show_module_numbers) {
      patchVisualization({ show_module_numbers: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (state.step !== "layout") return;
    if (state.selection.kind === "area" || state.selection.kind === "obstacle" || state.selection.kind === "launch") {
      select({ kind: "none", id: null });
    }
    setOverVertex(null);
    // Revalida módulos ao entrar na usina (limpa vermelho falso antigo)
    refreshValidity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);
  const [areaPicker, setAreaPicker] = useState(false);
  const [launchDraft, setLaunchDraft] = useState<{ corners: Pt[]; w: number; h: number } | null>(null);
  const [selectDraft, setSelectDraft] = useState<{ corners: Pt[]; w: number; h: number } | null>(null);
  const [launchPreview, setLaunchPreview] = useState<Array<{ x: number; y: number; w: number; h: number; orientation: "paisagem" | "retrato"; rotation: number }>>([]);
  const [rectPickIds, setRectPickIds] = useState<string[]>([]);
  const launchDraftRef = useRef(launchDraft);
  launchDraftRef.current = launchDraft;
  const selectDraftRef = useRef(selectDraft);
  selectDraftRef.current = selectDraft;
  const drag = useRef<{
    mode: "pan" | "vertex" | "module" | "module-group" | "crop" | "redact" | "scale-handle" | "heading-handle" | "launch-rect" | "select-rect" | null;
    sx: number;
    sy: number;
    vx: number;
    vy: number;
    id?: string;
    index?: number;
    kind?: "area" | "obstacle" | "launch";
    ox?: number;
    oy?: number;
    handle?: CropHandle;
    startRect?: { x: number; y: number; w: number; h: number };
    from?: Pt;
    gridDeg?: number;
    starts?: Array<{ id: string; x_m: number; y_m: number }>;
    ids?: string[];
    pending?: boolean;
  }>({ mode: null, sx: 0, sy: 0, vx: 0, vy: 0 });

  const image = state.image;
  const scalePoints: Pt[] =
    state.scaleDraft.length > 0
      ? state.scaleDraft
      : state.scale.reference
        ? [state.scale.reference.point_a, state.scale.reference.point_b]
        : [];
  const headingPoints: Pt[] =
    state.headingDraft?.length > 0
      ? state.headingDraft
      : state.scale.heading
        ? [state.scale.heading.point_a, state.scale.heading.point_b]
        : [];

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !image) return;
    const apply = () => {
      const pad = 48;
      const sx = (el.clientWidth - pad) / image.width_px;
      const sy = (el.clientHeight - pad) / image.height_px;
      setFit(Math.max(0.05, Math.min(sx, sy)));
      setView({ zoom: 1, x: 24, y: 24 });
    };
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, [image]);

  const fitView = () => {
    const el = stageRef.current;
    if (!el || !image) return;
    const pad = 48;
    const sx = (el.clientWidth - pad) / image.width_px;
    const sy = (el.clientHeight - pad) / image.height_px;
    setFit(Math.max(0.05, Math.min(sx, sy)));
    setView({ zoom: 1, x: 24, y: 24 });
  };

  const toImage = (clientX: number, clientY: number): Pt | null => {
    const el = stageRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left - view.x) / (view.zoom * fit);
    const y = (clientY - r.top - view.y) / (view.zoom * fit);
    return [x, y];
  };

  const closeEnough = (a: Pt, b: Pt, px = 12) => {
    const t = px / (view.zoom * fit);
    return Math.hypot(a[0] - b[0], a[1] - b[1]) <= t;
  };

  const groupIds = state.selection.kind === "module-group" ? state.selection.ids ?? [] : [];
  const groupBox = useMemo(() => {
    if (!groupIds.length || !state.layout || !state.scale.calibrated) return null;
    const mpp = state.scale.meters_per_pixel;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const m of state.layout.best.modules) {
      if (!groupIds.includes(m.id)) continue;
      for (const [px, py] of modulePolygon({
        ...m,
        x_m: m.x_m / mpp,
        y_m: m.y_m / mpp,
        width_m: m.width_m / mpp,
        height_m: m.height_m / mpp,
      })) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
    if (!Number.isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [groupIds, state.layout, state.scale.calibrated, state.scale.meters_per_pixel]);

  const startGroupDrag = (clientX: number, clientY: number) => {
    const origins = (state.layout?.best.modules ?? [])
      .filter((m) => groupIds.includes(m.id))
      .map((m) => ({ id: m.id, x_m: m.x_m, y_m: m.y_m }));
    drag.current = {
      mode: "module-group",
      sx: clientX,
      sy: clientY,
      vx: 0,
      vy: 0,
      ids: groupIds,
      starts: origins,
    };
  };

  const startSelectWindow = (p: Pt, clientX: number, clientY: number) => {
    const gridDeg = launchGridDegAt(p, state);
    drag.current = {
      mode: "select-rect",
      sx: clientX,
      sy: clientY,
      vx: 0,
      vy: 0,
      from: p,
      gridDeg,
    };
    setSelectDraft({ corners: [p, p, p, p], w: 0, h: 0 });
    setRectPickIds([]);
    setLaunchPreview([]);
  };

  const pointInGroupBox = (p: Pt) =>
    Boolean(
      groupBox &&
        p[0] >= groupBox.x &&
        p[0] <= groupBox.x + groupBox.w &&
        p[1] >= groupBox.y &&
        p[1] <= groupBox.y + groupBox.h,
    );

  const finishDraft = () => {
    finishOpenDraft();
  };

  const previewLaunchRect = (corners: Pt[], w: number, h: number) => {
    if (!state.scale.calibrated || w < 8 || h < 8 || corners.length < 4) {
      setLaunchPreview([]);
      return;
    }
    const packed = packOrientedPolygon(
      corners,
      state.launch_orientation ?? "paisagem",
      state.areas,
      state.obstacles,
      state.module,
      state.scale.meters_per_pixel,
      "preview",
      state.layout?.best.modules ?? [],
    );
    const mpp = state.scale.meters_per_pixel;
    setLaunchPreview(
      packed.modules.map((m) => ({
        x: m.x_m / mpp,
        y: m.y_m / mpp,
        w: m.width_m / mpp,
        h: m.height_m / mpp,
        orientation: m.orientation,
        rotation: m.rotation_deg ?? 0,
      })),
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") {
        setDraft([]);
        setRedactDraft(null);
        setLaunchDraft(null);
        setSelectDraft(null);
        setLaunchPreview([]);
        setRectPickIds([]);
        if (state.tool === "scale" && state.scaleDraft.length === 1) setScaleDraft([]);
        if (state.tool === "heading" && state.headingDraft.length === 1) setHeadingDraft([]);
        if (state.tool === "ruler") {
          setRuler(null);
          setModuleTape(null);
        }
        if (state.tool === "crop" || state.step === "edit") {
          setCrop(null);
          if (state.tool === "crop") setTool("pan");
          setNotice("Recorte cancelado. Esc limpa a moldura.");
        }
        if (state.tool === "redact") {
          if (state.selection.kind === "redact") select({ kind: "none", id: null });
          setTool("pan");
        }
        drag.current.mode = null;
        setPanning(false);
        setHoldingScale(false);
        setHoldingVertex(false);
        endUndoGesture();
      }
      if (e.key === "Enter" && (state.tool === "crop" || state.tool === "redact" || state.step === "edit")) {
        void applyImageEdit();
      }
      if (e.key === "Enter" && state.draft.length >= 3) {
        finishDraft();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && state.selection.kind !== "none") {
        deleteSelected();
      }
      if ((e.key === "r" || e.key === "R") && (state.selection.kind === "module" || state.selection.kind === "module-group")) {
        rotateSelectedModules();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    applyImageEdit,
    deleteSelected,
    endUndoGesture,
    finishOpenDraft,
    rotateSelectedModules,
    select,
    setCrop,
    setDraft,
    setHeadingDraft,
    setNotice,
    setRuler,
    setScaleDraft,
    setTool,
    state.draft,
    state.scaleDraft.length,
    state.selection.kind,
    state.step,
    state.tool,
  ]);

  const hitVertex = (p: Pt) => {
    const onUsina = state.step === "layout";
    // Na usina, telhado/obstáculo ficam só na camada visual — sem editar vértices.
    const canEditRoof =
      !onUsina &&
      (state.tool === "select" ||
        state.tool === "area" ||
        state.tool === "obstacle" ||
        state.step === "draw");
    // Lançamento: só com a ferramenta «Inserir bloco» (ou o lançamento já selecionado nessa ferramenta).
    // No Editar/select da usina, não captura vértices de lançamento — evita polígonos fantasma.
    const canEditLaunch =
      state.tool === "launch" ||
      (!onUsina && (state.tool === "select" || state.step === "draw") && state.selection.kind === "launch");
    if (!canEditRoof && !canEditLaunch) return null;

    type Hit = { kind: "area" | "obstacle" | "launch"; id: string; index: number; pt: Pt };
    const lists: Array<{ kind: "area" | "obstacle" | "launch"; items: Array<{ id: string; polygon_px: Pt[] }> }> = [];
    if (canEditRoof) {
      lists.push({ kind: "area", items: state.areas }, { kind: "obstacle", items: state.obstacles });
    }
    if (canEditLaunch) {
      lists.push({ kind: "launch", items: state.launches ?? [] });
    }
    if (!lists.length) return null;

    const vertexTol = 18 / Math.max(view.zoom * fit, 0.04);
    const edgeTol = 14 / Math.max(view.zoom * fit, 0.04);

    const scanVertices = (onlyId: string | null): Hit | null => {
      let best: Hit | null = null;
      let bestD = vertexTol;
      for (const group of lists) {
        for (const item of group.items) {
          if (onlyId && item.id !== onlyId) continue;
          item.polygon_px.forEach((pt, index) => {
            const d = Math.hypot(p[0] - pt[0], p[1] - pt[1]);
            if (d <= bestD) {
              bestD = d;
              best = { kind: group.kind, id: item.id, index, pt };
            }
          });
        }
      }
      return best;
    };

    const selectedHit = state.selection.id ? scanVertices(state.selection.id) : null;
    if (selectedHit) return selectedHit;
    const anyHit = scanVertices(null);
    if (anyHit) return anyHit;

    let edgeBest: Hit | null = null;
    let edgeBestD = edgeTol;
    for (const group of lists) {
      for (const item of group.items) {
        const pts = item.polygon_px;
        if (pts.length < 2) continue;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const len2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
          const qx = a[0] + t * dx;
          const qy = a[1] + t * dy;
          const d = Math.hypot(p[0] - qx, p[1] - qy);
          if (d > edgeBestD) continue;
          edgeBestD = d;
          const index = t < 0.5 ? i : (i + 1) % pts.length;
          edgeBest = { kind: group.kind, id: item.id, index, pt: pts[index] };
        }
      }
    }
    return edgeBest;
  };

  const hitPoly = (p: Pt, polys: Array<{ id: string; polygon_px: Pt[] }>) => {
    for (let i = polys.length - 1; i >= 0; i--) {
      const poly = polys[i].polygon_px;
      let inside = false;
      for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        const [xi, yi] = poly[a];
        const [xj, yj] = poly[b];
        const inter = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-9) + xi;
        if (inter) inside = !inside;
      }
      if (inside) return polys[i].id;
    }
    return null;
  };

  const snapMeasurePoint = (p: Pt): Pt => {
    if (!state.layout || !state.scale.calibrated) return p;
    const mpp = state.scale.meters_per_pixel;
    let best: Pt | null = null;
    let bestD = Infinity;
    const limit = 14 / (view.zoom * fit);
    for (const m of state.layout.best.modules) {
      const corners = modulePolygon({
        x_m: m.x_m / mpp,
        y_m: m.y_m / mpp,
        width_m: m.width_m / mpp,
        height_m: m.height_m / mpp,
        rotation_deg: m.rotation_deg,
      });
      for (const c of corners) {
        const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
        if (d < bestD && d <= limit) {
          bestD = d;
          best = c;
        }
      }
    }
    return best ?? p;
  };

  const hitModule = (p: Pt) => {
    if (!state.layout || !state.scale.calibrated) return null;
    const mpp = state.scale.meters_per_pixel;
    for (const m of [...state.layout.best.modules].reverse()) {
      if (
        pointInModule(p, {
          x_m: m.x_m / mpp,
          y_m: m.y_m / mpp,
          width_m: m.width_m / mpp,
          height_m: m.height_m / mpp,
          rotation_deg: m.rotation_deg,
        })
      ) {
        return m;
      }
    }
    return null;
  };

  const modulesTouchingPoly = (poly: Pt[]) => {
    if (!state.layout || !state.scale.calibrated || poly.length < 3) return [];
    const mpp = state.scale.meters_per_pixel;
    return state.layout.best.modules
      .filter((m) => {
        const mod = modulePolygon({
          x_m: m.x_m / mpp,
          y_m: m.y_m / mpp,
          width_m: m.width_m / mpp,
          height_m: m.height_m / mpp,
          rotation_deg: m.rotation_deg,
        });
        return polygonsTouchOrOverlap(mod, poly);
      })
      .map((m) => m.id);
  };

  const applyModuleIds = (ids: string[]) => {
    if (ids.length > 1) select({ kind: "module-group", id: ids[0], ids });
    else if (ids.length === 1) select({ kind: "module", id: ids[0] });
    else select({ kind: "none", id: null });
  };

  const selectedModuleIds = () => {
    if (state.selection.kind === "module-group") return state.selection.ids ?? [];
    if (state.selection.kind === "module" && state.selection.id) return [state.selection.id];
    return [];
  };

  const pickModule = (mod: NonNullable<ReturnType<typeof hitModule>>, e: React.PointerEvent) => {
    if (state.tool === "ruler" || state.tool === "place-module") {
      setModuleTape(null);
      setTool("select");
    }
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      const ids = new Set(selectedModuleIds());
      if (ids.has(mod.id)) ids.delete(mod.id);
      else ids.add(mod.id);
        applyModuleIds([...ids]);
      return;
    }
    select({ kind: "module", id: mod.id });
    drag.current = {
      mode: "module",
      sx: e.clientX,
      sy: e.clientY,
      vx: 0,
      vy: 0,
      id: mod.id,
      ox: mod.x_m,
      oy: mod.y_m,
      pending: true,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      if ((state.tool === "area" || state.tool === "obstacle" || state.tool === "group") && state.draft.length > 0) {
        setDraft(state.draft.slice(0, -1));
      }
      return;
    }
    if (!image) return;
    const p = toImage(e.clientX, e.clientY);
    if (!p) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (e.button === 1 || state.tool === "pan" || e.altKey) {
      drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      setPanning(true);
      return;
    }

    if (state.tool === "crop") {
      const tol = 10 / (view.zoom * fit);
      if (state.crop) {
        const handle = hitCropHandle(p, state.crop, tol);
        if (handle) {
          drag.current = {
            mode: "crop",
            sx: e.clientX,
            sy: e.clientY,
            vx: 0,
            vy: 0,
            handle,
            startRect: { ...state.crop },
            from: p,
          };
          return;
        }
      }
      drag.current = {
        mode: "crop",
        sx: e.clientX,
        sy: e.clientY,
        vx: 0,
        vy: 0,
        handle: undefined,
        from: p,
      };
      setCrop({ x: p[0], y: p[1], w: 1, h: 1 });
      return;
    }

    if (state.tool === "redact") {
      const hit = [...state.redacts].reverse().find((r) =>
        p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h,
      );
      if (hit) {
        select({ kind: "redact", id: hit.id });
        drag.current = {
          mode: "redact",
          sx: e.clientX,
          sy: e.clientY,
          vx: 0,
          vy: 0,
          id: hit.id,
          handle: "move",
          startRect: { x: hit.x, y: hit.y, w: hit.w, h: hit.h },
          from: p,
        };
        return;
      }
      drag.current = { mode: "redact", sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, from: p };
      return;
    }

    if (state.tool === "scale") {
      const hit = scalePoints.findIndex((pt) => closeEnough(p, pt, 16));
      if (hit >= 0) {
        drag.current = {
          mode: "scale-handle",
          sx: e.clientX,
          sy: e.clientY,
          vx: 0,
          vy: 0,
          index: hit,
        };
        setHoldingScale(true);
        return;
      }
      if (scalePoints.length >= 2) return;
      const next = [...scalePoints, p];
      setScaleDraft(next);
      if (next.length === 2) applyTwoPointScale(next[0], next[1], scaleMeters);
      return;
    }

    if (state.tool === "heading") {
      const hit = headingPoints.findIndex((pt) => closeEnough(p, pt, 16));
      if (hit >= 0) {
        drag.current = {
          mode: "heading-handle",
          sx: e.clientX,
          sy: e.clientY,
          vx: 0,
          vy: 0,
          index: hit,
        };
        return;
      }
      if (headingPoints.length >= 2) {
        setHeadingDraft([]);
      }
      const base = headingPoints.length >= 2 ? [] : headingPoints;
      const next = [...base, p];
      setHeadingDraft(next);
      if (next.length === 2) applyHeading(next[0], next[1]);
      return;
    }

    if (state.tool === "ruler") {
      const mod = hitModule(p);
      if (mod && (state.selection.id === mod.id || groupIds.includes(mod.id))) {
        pickModule(mod, e);
        return;
      }
      if (mod && state.scale.calibrated) {
        const mpp = state.scale.meters_per_pixel;
        const [x, y] = mToPx([mod.x_m, mod.y_m], mpp);
        const w = mod.width_m / mpp;
        const h = mod.height_m / mpp;
        setModuleTape({ x, y, w, h, width_m: mod.width_m, height_m: mod.height_m });
        setRuler({ a: [x, y], b: [x + w, y] });
        select({ kind: "module", id: mod.id });
        return;
      }
      const snapped = snapMeasurePoint(p);
      setModuleTape(null);
      if (!state.ruler) setRuler({ a: snapped, b: snapped });
      else if (state.ruler.a && state.ruler.b && Math.hypot(state.ruler.a[0] - state.ruler.b[0], state.ruler.a[1] - state.ruler.b[1]) < 1e-3) {
        setRuler({ a: state.ruler.a, b: snapped });
      } else {
        setRuler({ a: snapped, b: snapped });
      }
      return;
    }

    if (state.tool === "launch") {
      // Ctrl/Shift: seleciona módulo. Senão sempre abre o retângulo de lançamento
      // (mesmo sobre módulo) — com o telhado cheio o clique não pode “morrer” no pick.
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        const mod = hitModule(p);
        if (mod) pickModule(mod, e);
        return;
      }
      if (groupIds.length > 1 && pointInGroupBox(p) && e.altKey) {
        startGroupDrag(e.clientX, e.clientY);
        return;
      }
      if (selectedModuleIds().length) select({ kind: "none", id: null });
      const gridDeg = launchGridDegAt(p, state);
      drag.current = { mode: "launch-rect", sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, from: p, gridDeg };
      setLaunchDraft({ corners: [p, p, p, p], w: 0, h: 0 });
      setLaunchPreview([]);
      setRectPickIds([]);
      return;
    }

    if (state.tool === "group" || (state.tool === "select" && state.step === "layout")) {
      // Arrastar bloco já selecionado
      if (groupIds.length && pointInGroupBox(p)) {
        startGroupDrag(e.clientX, e.clientY);
        return;
      }
      const mod = hitModule(p);
      if (mod) {
        pickModule(mod, e);
        return;
      }
      // Caixa de seleção estilo AutoCAD (arraste)
      startSelectWindow(p, e.clientX, e.clientY);
      return;
    }

    if (state.tool === "area" || state.tool === "obstacle") {
      if (areaPicker) return;
      if (state.draft.length === 0) {
        const v = hitVertex(p);
        if (v) {
          select({ kind: v.kind, id: v.id, vertexIndex: v.index });
          drag.current = { mode: "vertex", sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, id: v.id, index: v.index, kind: v.kind };
          setHoldingVertex(true);
          return;
        }
      }
      if (state.draft.length >= 3 && closeEnough(p, state.draft[0], 20)) {
        finishDraft();
        return;
      }
      if (state.draft.length === 0) select({ kind: "none", id: null });
      setDraft([...state.draft, p]);
      return;
    }

    if (state.tool === "place-module") {
      const existing = hitModule(p);
      if (existing) {
        pickModule(existing, e);
        return;
      }
      if (!state.scale.calibrated) return;
      const mpp = state.scale.meters_per_pixel;
      placeManualModule(p[0] * mpp, p[1] * mpp);
      return;
    }

    const v = hitVertex(p);
    // Na usina, módulos têm prioridade sobre qualquer alça de lançamento
    if (state.step === "layout") {
      if (groupIds.length && pointInGroupBox(p)) {
        startGroupDrag(e.clientX, e.clientY);
        return;
      }
      const modFirst = hitModule(p);
      if (modFirst) {
        pickModule(modFirst, e);
        return;
      }
      if (v && v.kind === "launch" && state.tool === "launch") {
        select({ kind: v.kind, id: v.id, vertexIndex: v.index });
        drag.current = { mode: "vertex", sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, id: v.id, index: v.index, kind: v.kind };
        setHoldingVertex(true);
        return;
      }
      // Editar / restante: caixa de seleção no vazio
      if (state.tool === "select" || state.tool === "group") {
        startSelectWindow(p, e.clientX, e.clientY);
        return;
      }
      select({ kind: "none", id: null });
      return;
    }
    if (v) {
      select({ kind: v.kind, id: v.id, vertexIndex: v.index });
      drag.current = { mode: "vertex", sx: e.clientX, sy: e.clientY, vx: 0, vy: 0, id: v.id, index: v.index, kind: v.kind };
      setHoldingVertex(true);
      return;
    }
    if (groupIds.length && pointInGroupBox(p)) {
      startGroupDrag(e.clientX, e.clientY);
      return;
    }
    const mod = hitModule(p);
    if (mod) {
      pickModule(mod, e);
      return;
    }
    if (selectedModuleIds().length) {
      select({ kind: "none", id: null });
      return;
    }
    // Telhado/obstáculo: só selecionáveis fora da etapa Usina
    if (state.step !== "layout") {
      const areaId = hitPoly(p, state.areas);
      if (areaId) {
        select({ kind: "area", id: areaId });
        return;
      }
      const obsId = hitPoly(p, state.obstacles);
      if (obsId) {
        select({ kind: "obstacle", id: obsId });
        return;
      }
    }
    select({ kind: "none", id: null });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current.mode === "pan") {
      setView((v) => ({
        ...v,
        x: drag.current.vx + (e.clientX - drag.current.sx),
        y: drag.current.vy + (e.clientY - drag.current.sy),
      }));
      return;
    }
    const p = toImage(e.clientX, e.clientY);
    if (!p) return;
    if (state.tool === "scale") {
      const hit = scalePoints.findIndex((pt) => closeEnough(p, pt, 16));
      setOverScaleHandle(hit >= 0 ? hit : null);
    }
    if (state.tool === "heading") {
      const hit = headingPoints.findIndex((pt) => closeEnough(p, pt, 16));
      setOverScaleHandle(hit >= 0 ? hit : null);
    }
    if (drag.current.mode == null && state.draft.length === 0) {
      const hover = hitVertex(p);
      setOverVertex(hover ? { id: hover.id, index: hover.index } : null);
    }
    if (drag.current.mode === "scale-handle" && drag.current.index != null) {
      const next = scalePoints.map((pt, i) => (i === drag.current.index ? p : pt));
      setScaleDraft(next);
      if (next.length === 2) applyTwoPointScale(next[0], next[1], scaleMeters);
    }
    if (drag.current.mode === "heading-handle" && drag.current.index != null) {
      const next = headingPoints.map((pt, i) => (i === drag.current.index ? p : pt));
      setHeadingDraft(next);
      if (next.length === 2) applyHeading(next[0], next[1]);
    }
    if (state.tool === "ruler" && state.ruler && e.buttons === 1 && !moduleTape) {
      setRuler({ a: state.ruler.a, b: snapMeasurePoint(p) });
    }
    if (drag.current.mode === "crop" && drag.current.from && image) {
      if (drag.current.handle && drag.current.startRect) {
        setCrop(resizeRect(drag.current.startRect, drag.current.handle, drag.current.from, p, {
          w: image.width_px,
          h: image.height_px,
        }));
      } else {
        setCrop(normalizeRect(drag.current.from[0], drag.current.from[1], p[0], p[1]));
      }
    }
    if (drag.current.mode === "redact" && drag.current.from && image) {
      if (drag.current.id && drag.current.startRect) {
        updateRedact(drag.current.id, resizeRect(drag.current.startRect, "move", drag.current.from, p, {
          w: image.width_px,
          h: image.height_px,
        }));
      } else {
        const next = normalizeRect(drag.current.from[0], drag.current.from[1], p[0], p[1]);
        drag.current.startRect = next;
        setRedactDraft(next);
      }
    }
    if (drag.current.mode === "vertex" && drag.current.id != null && drag.current.index != null && drag.current.kind) {
      moveVertex(drag.current.kind, drag.current.id, drag.current.index, p);
    }
    if (drag.current.mode === "module" && drag.current.id && state.scale.calibrated) {
      const px = Math.hypot(e.clientX - drag.current.sx, e.clientY - drag.current.sy);
      if (drag.current.pending && px < 5) return;
      drag.current.pending = false;
      const dx = (e.clientX - drag.current.sx) / (view.zoom * fit) * state.scale.meters_per_pixel;
      const dy = (e.clientY - drag.current.sy) / (view.zoom * fit) * state.scale.meters_per_pixel;
      moveModule(drag.current.id, (drag.current.ox ?? 0) + dx, (drag.current.oy ?? 0) + dy);
    }
    if (drag.current.mode === "module-group" && drag.current.ids && drag.current.starts && state.scale.calibrated) {
      const dx = (e.clientX - drag.current.sx) / (view.zoom * fit) * state.scale.meters_per_pixel;
      const dy = (e.clientY - drag.current.sy) / (view.zoom * fit) * state.scale.meters_per_pixel;
      moveModuleGroup(drag.current.ids, drag.current.starts, dx, dy);
    }
    if (drag.current.mode === "launch-rect" && drag.current.from) {
      const gridDeg = drag.current.gridDeg ?? 0;
      const draft = orientedLaunchRect(drag.current.from, p, gridDeg);
      setLaunchDraft(draft);
      // Preview sempre tenta empacotar (occupied evita sobrepor); não vira seleção.
      if (draft.w >= 8 && draft.h >= 8) previewLaunchRect(draft.corners, draft.w, draft.h);
      else setLaunchPreview([]);
      setRectPickIds([]);
    }
    if (drag.current.mode === "select-rect" && drag.current.from) {
      const gridDeg = drag.current.gridDeg ?? 0;
      const draft = orientedLaunchRect(drag.current.from, p, gridDeg);
      setSelectDraft(draft);
      const hit = draft.w >= 2 && draft.h >= 2 ? modulesTouchingPoly(draft.corners) : [];
      setRectPickIds(hit);
    }
  };

  const onPointerUp = () => {
    if (drag.current.mode === "redact" && !drag.current.id && drag.current.startRect) {
      addRedact(drag.current.startRect);
      setRedactDraft(null);
    }
    if (drag.current.mode === "launch-rect" && launchDraftRef.current) {
      const r = launchDraftRef.current;
      // Inserir bloco: sempre lança (não rouba para seleção — use Editar/Seleção).
      if (r.w > 8 && r.h > 8) {
        addLaunch(r.corners);
      } else {
        select({ kind: "none", id: null });
      }
      setLaunchDraft(null);
      setLaunchPreview([]);
      setRectPickIds([]);
    }
    if (drag.current.mode === "select-rect" && selectDraftRef.current) {
      const r = selectDraftRef.current;
      const hit = r.w >= 2 && r.h >= 2 ? modulesTouchingPoly(r.corners) : [];
      if (hit.length) applyModuleIds(hit);
      else select({ kind: "none", id: null });
      setSelectDraft(null);
      setRectPickIds([]);
    }
    drag.current.mode = null;
    setPanning(false);
    setHoldingScale(false);
    setHoldingVertex(false);
    endUndoGesture();
  };

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setView((v) => {
        const zoom = Math.min(8, Math.max(0.3, v.zoom * factor));
        const k = zoom / v.zoom;
        return { zoom, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
      });
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);

  const onDoubleClick = () => {
    if (state.draft.length >= 3) finishDraft();
  };

  const measured = useMemo(() => {
    if (!state.ruler || !state.scale.calibrated) return null;
    const px = Math.hypot(state.ruler.b[0] - state.ruler.a[0], state.ruler.b[1] - state.ruler.a[1]);
    if (px < 1e-6) return null;
    const meters = px * state.scale.meters_per_pixel;
    const match = matchModuleSide(meters, state.module.width_m, state.module.height_m);
    return { px, meters, match };
  }, [state.ruler, state.scale, state.module.width_m, state.module.height_m]);

  const generatedBar = useMemo(() => {
    if (!state.scale.calibrated || !state.scale.reference) return null;
    const a = state.scale.reference.point_a;
    const b = state.scale.reference.point_b;
    return { ...offsetBar(a, b, -22), meters: state.scale.reference.real_distance_m };
  }, [state.scale]);

  const checkBar = useMemo(() => {
    if (!state.scale.check || !state.scale.reference) return null;
    const a = state.scale.reference.point_a;
    const b = state.scale.reference.point_b;
    return {
      ...barFrom(a, b, state.scale.check.generated_px, 22),
      meters: state.scale.check.check_m,
      ok: state.scale.check.ok,
    };
  }, [state.scale]);

  const ui = 1 / Math.max(view.zoom * fit, 0.04);

  return (
    <div className="stage-wrap">
      {state.scale.heading && (
        <div className="site-compass" title="Bússola do imóvel — a figura não girou">
          <svg viewBox="0 0 72 72" aria-hidden>
            <circle cx="36" cy="36" r="32" fill="rgba(12,16,22,0.82)" stroke="#7ec8ff" strokeWidth="1.6" />
            <text x="36" y="14" textAnchor="middle" fill="#c9d4e0" fontSize="8" fontWeight="700">N</text>
            <g transform={`rotate(${state.scale.heading.azimuth_deg - 90} 36 36)`}>
              <line x1="12" y1="36" x2="60" y2="36" stroke="#7ec8ff" strokeWidth="3" strokeLinecap="round" />
              <polygon points="60,36 52,32 52,40" fill="#7ec8ff" />
            </g>
          </svg>
          <span>
            desvio {(state.scale.heading.azimuth_deg - 90).toFixed(1)}°
          </span>
        </div>
      )}
      <StageTools
        areaPicker={areaPicker}
        setAreaPicker={setAreaPicker}
        scaleMeters={scaleMeters}
        setModuleTapeNull={() => setModuleTape(null)}
        fitView={fitView}
      />
      <div className="layer-toggles" onPointerDown={(e) => e.stopPropagation()}>
        <label className="layer-toggle">
          <input
            type="checkbox"
            checked={showAreas}
            onChange={(e) => {
              setShowAreas(e.target.checked);
              localStorage.setItem("pepilene-show-areas", e.target.checked ? "1" : "0");
            }}
          />
          view de áreas
        </label>
        <label className="layer-toggle">
          <input
            type="checkbox"
            checked={showModuleNumbers}
            onChange={(e) => {
              const on = e.target.checked;
              patchVisualization({ show_module_numbers: on });
              localStorage.setItem("pepilene-show-mod-nums", on ? "1" : "0");
            }}
          />
          view number módulos
        </label>
      </div>
      <div className="legend">
        <span><i style={{ background: "#3dba7a" }} />útil</span>
        <span><i style={{ background: "#5ec8d6" }} />recuo</span>
        <span><i style={{ background: "#e05a4f" }} />restrita</span>
        {defaults.show_launch_rects && <span><i style={{ background: "#c9a227" }} />lançar</span>}
        <span><i style={{ background: "#e8a317" }} />módulo</span>
        <span><i style={{ background: "#0b0e12" }} />oculta</span>
      </div>
      <div
        ref={stageRef}
        className={`stage ${state.tool === "pan" ? "pan" : ""} ${state.tool === "launch" ? "launch" : ""} ${state.tool === "group" ? "group" : ""} ${panning || holdingScale || holdingVertex ? "panning" : ""} ${overVertex != null || ((state.tool === "scale" || state.tool === "heading") && overScaleHandle != null) ? "grab" : ""} ${overVertex != null ? "vertex-hover" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {image && (
          <div
            className="world"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
              width: image.width_px * fit,
              height: image.height_px * fit,
            }}
          >
            <img
              src={
                state.visualization?.compare_original
                  ? image.original_src || image.src
                  : state.visualization?.use_enhanced && state.visualization.enhanced_src
                    ? state.visualization.enhanced_src
                    : image.src
              }
              alt={image.file}
              width={image.width_px * fit}
              height={image.height_px * fit}
            />
            <svg viewBox={`0 0 ${image.width_px} ${image.height_px}`} width={image.width_px * fit} height={image.height_px * fit}>
              {state.crop && state.tool === "crop" && (
                <g>
                  <path
                    fill="rgba(8,10,12,0.58)"
                    fillRule="evenodd"
                    d={`M0 0H${image.width_px}V${image.height_px}H0Z M${state.crop.x} ${state.crop.y}H${state.crop.x + state.crop.w}V${state.crop.y + state.crop.h}H${state.crop.x}Z`}
                  />
                  <rect
                    x={state.crop.x}
                    y={state.crop.y}
                    width={state.crop.w}
                    height={state.crop.h}
                    fill="none"
                    stroke="#f3c15b"
                    strokeWidth={2 * ui}
                  />
                  {handlePoints(state.crop).map((h) => (
                    <rect
                      key={h.id}
                      x={h.p[0] - 5 * ui}
                      y={h.p[1] - 5 * ui}
                      width={10 * ui}
                      height={10 * ui}
                      fill="#f3c15b"
                      stroke="#1a1408"
                      strokeWidth={1 * ui}
                    />
                  ))}
                  <text
                    x={state.crop.x + state.crop.w / 2}
                    y={state.crop.y - 10 * ui}
                    fill="#f3c15b"
                    fontSize={13 * ui}
                    textAnchor="middle"
                  >
                    {Math.round(state.crop.w)} × {Math.round(state.crop.h)} px · Esc cancela
                  </text>
                </g>
              )}
              {[...(state.redacts ?? []), ...(redactDraft ? [{ ...redactDraft, id: "draft-hide" }] : [])].map((r) => (
                <rect
                  key={r.id}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill="rgba(11,14,18,0.78)"
                  stroke={state.selection.id === r.id ? "#f3c15b" : "#8b95a3"}
                  strokeDasharray={r.id === "draft-hide" ? `${6 * ui} ${4 * ui}` : undefined}
                  strokeWidth={1.5 * ui}
                />
              ))}
              {showAreas && state.areas.map((a) => {
                const on = state.selection.kind === "area" && state.selection.id === a.id;
                return (
                  <polygon
                    key={a.id}
                    points={a.polygon_px.map((p) => p.join(",")).join(" ")}
                    fill={
                      on
                        ? "rgba(12, 86, 42, 0.48)"
                        : a.active
                          ? "rgba(61,186,122,0.18)"
                          : "rgba(139,149,163,0.12)"
                    }
                    stroke={on ? "#0a3d22" : "#3dba7a"}
                    strokeWidth={(on ? 2.6 : 1.6) * ui}
                  />
                );
              })}
              {showAreas && state.step !== "layout" && state.layout?.usable_polygons_px.map((u) =>
                u.polygon_px.length ? (
                  <polygon
                    key={`u-${u.areaId}`}
                    points={u.polygon_px.map((p) => p.join(",")).join(" ")}
                    fill="none"
                    stroke="#5ec8d6"
                    strokeDasharray={`${8 * ui} ${5 * ui}`}
                    strokeWidth={1.4 * ui}
                  />
                ) : null,
              )}
              {/* Lançamentos: só na ferramenta «Inserir bloco» — na edição da usina não sobrepõem os módulos */}
              {state.tool === "launch" &&
                (state.launches ?? [])
                  .filter((z) => (state.layout?.best.modules ?? []).some((m) => m.launch_id === z.id))
                  .map((z) => {
                    const on = state.selection.kind === "launch" && state.selection.id === z.id;
                    return (
                      <polygon
                        key={z.id}
                        points={z.polygon_px.map((p) => p.join(",")).join(" ")}
                        fill={on ? "rgba(201, 162, 39, 0.22)" : "rgba(201, 162, 39, 0.08)"}
                        stroke={on ? "#8a6d12" : "#c9a227"}
                        strokeWidth={(on ? 2.4 : 1.6) * ui}
                        strokeDasharray={`${7 * ui} ${5 * ui}`}
                        style={{ pointerEvents: "none" }}
                      />
                    );
                  })}
              {showAreas && state.visualization?.show_obstacles !== false && state.obstacles.map((o) => {
                const on = state.selection.kind === "obstacle" && state.selection.id === o.id;
                return (
                  <polygon
                    key={o.id}
                    points={o.polygon_px.map((p) => p.join(",")).join(" ")}
                    fill={on ? "rgba(110, 16, 16, 0.52)" : "rgba(224,90,79,0.28)"}
                    stroke={on ? "#6b1010" : "#e05a4f"}
                    strokeWidth={(on ? 2.6 : 1.6) * ui}
                  />
                );
              })}
              {launchDraft && launchDraft.corners.length >= 3 && (
                <polygon
                  points={launchDraft.corners.map((c) => c.join(",")).join(" ")}
                  fill="rgba(201, 162, 39, 0.12)"
                  stroke="#c9a227"
                  strokeWidth={1.6 * ui}
                  strokeDasharray={`${6 * ui} ${4 * ui}`}
                />
              )}
              {selectDraft && selectDraft.corners.length >= 3 && (
                <polygon
                  points={selectDraft.corners.map((c) => c.join(",")).join(" ")}
                  fill="rgba(126, 200, 255, 0.14)"
                  stroke="#7ec8ff"
                  strokeWidth={1.8 * ui}
                  strokeDasharray={`${5 * ui} ${4 * ui}`}
                />
              )}
              {launchPreview.map((m, i) => (
                <ModuleSprite
                  key={`prev-${i}`}
                  x={m.x}
                  y={m.y}
                  w={m.w}
                  h={m.h}
                  orientation={m.orientation}
                  rotation={m.rotation}
                  selected={false}
                  violation={false}
                  ui={ui}
                  number={showModuleNumbers ? (state.layout?.best.modules.length ?? 0) + i + 1 : undefined}
                />
              ))}
              {state.visualization?.show_modules !== false && state.layout?.best.modules.map((m, i) => {
                const mpp = state.scale.meters_per_pixel || 1;
                const [x, y] = mToPx([m.x_m, m.y_m], mpp);
                const w = m.width_m / mpp;
                const h = m.height_m / mpp;
                return (
                  <ModuleSprite
                    key={m.id}
                    x={x}
                    y={y}
                    w={w}
                    h={h}
                    orientation={m.orientation}
                    rotation={m.rotation_deg ?? 0}
                    selected={state.selection.id === m.id || groupIds.includes(m.id) || rectPickIds.includes(m.id)}
                    violation={Boolean(m.violation)}
                    ui={ui}
                    number={showModuleNumbers ? i + 1 : undefined}
                  />
                );
              })}
              {groupBox && (
                <rect
                  x={groupBox.x - 4 * ui}
                  y={groupBox.y - 4 * ui}
                  width={groupBox.w + 8 * ui}
                  height={groupBox.h + 8 * ui}
                  fill="rgba(243, 193, 91, 0.08)"
                  stroke="#fff4d2"
                  strokeWidth={1.8 * ui}
                  strokeDasharray={`${8 * ui} ${5 * ui}`}
                />
              )}
              {[...state.areas, ...state.obstacles, ...(state.launches ?? [])]
                .filter((item) => {
                  const isLaunch = (state.launches ?? []).some((z) => z.id === item.id);
                  const isRoof =
                    state.areas.some((a) => a.id === item.id) || state.obstacles.some((o) => o.id === item.id);
                  // Usina: sem alças de telhado; lançamento só com ferramenta Inserir bloco
                  if (state.step === "layout") {
                    if (isRoof) return false;
                    return (
                      isLaunch &&
                      state.tool === "launch" &&
                      (overVertex?.id === item.id || state.selection.id === item.id)
                    );
                  }
                  if (overVertex?.id === item.id) return true;
                  if (state.selection.id === item.id) return true;
                  const editingPoly =
                    state.tool === "select" || state.tool === "area" || state.tool === "obstacle";
                  if (!editingPoly || !showAreas) return false;
                  return isRoof;
                })
                .flatMap((item) =>
                  item.polygon_px.map((pt, i) => {
                    const active =
                      (state.selection.id === item.id && state.selection.vertexIndex === i) ||
                      (overVertex?.id === item.id && overVertex.index === i);
                    const selected = state.selection.id === item.id;
                    return (
                      <circle
                        key={`${item.id}-v${i}`}
                        cx={pt[0]}
                        cy={pt[1]}
                        r={(active ? 7 : selected ? 5 : 4) * ui}
                        fill={active ? "#fff4d2" : selected ? "#fff" : "rgba(255,255,255,0.9)"}
                        stroke={active ? "#c48910" : "#1a1408"}
                        strokeWidth={(active ? 1.6 : 1.1) * ui}
                        style={{ pointerEvents: "none" }}
                      />
                    );
                  }),
                )}
              {state.draft.length > 0 && (
                <g>
                  <polyline
                    points={[...state.draft, state.draft[0]].map((p) => p.join(",")).join(" ")}
                    fill="rgba(232,163,23,0.12)"
                    stroke="#f3c15b"
                    strokeDasharray={`${6 * ui} ${4 * ui}`}
                    strokeWidth={1.6 * ui}
                  />
                  {state.draft.map((pt, i) => (
                    <circle
                      key={`draft-${i}`}
                      cx={pt[0]}
                      cy={pt[1]}
                      r={(i === 0 ? 6 : 4) * ui}
                      fill={i === 0 ? "#fff4d2" : "#f3c15b"}
                      stroke="#1a1408"
                    />
                  ))}
                </g>
              )}
              {state.step === "scale" && scalePoints.length > 0 && (
                <g>
                  {scalePoints.length === 2 && (
                    <line
                      x1={scalePoints[0][0]}
                      y1={scalePoints[0][1]}
                      x2={scalePoints[1][0]}
                      y2={scalePoints[1][1]}
                      stroke="#f3c15b"
                      strokeWidth={2 * ui}
                    />
                  )}
                  {scalePoints.map((pt, i) => (
                    <circle
                      key={`scale-${i}`}
                      cx={pt[0]}
                      cy={pt[1]}
                      r={(overScaleHandle === i ? 6 : 4.5) * ui}
                      fill={overScaleHandle === i ? "#fff4d2" : "#f3c15b"}
                      stroke="#1a1408"
                      strokeWidth={1.2 * ui}
                    />
                  ))}
                  {scalePoints.length === 2 && (
                    <text
                      x={(scalePoints[0][0] + scalePoints[1][0]) / 2}
                      y={(scalePoints[0][1] + scalePoints[1][1]) / 2 - 12 * ui}
                      fill="#f3c15b"
                      fontSize={12 * ui}
                      fontWeight={700}
                      textAnchor="middle"
                    >
                      sua escala · {scaleMeters.toFixed(scaleMeters % 1 ? 2 : 0)} m
                    </text>
                  )}
                </g>
              )}
              {state.step === "scale" && generatedBar && (
                  <ScaleDimension
                    a={generatedBar.a}
                    b={generatedBar.b}
                    color="#5ec8d6"
                    label={`régua gerada · ${generatedBar.meters.toFixed(generatedBar.meters % 1 ? 2 : 0)} m`}
                    ui={ui}
                  />
                )}
              {state.step === "scale" && checkBar && (
                <ScaleDimension
                  a={checkBar.a}
                  b={checkBar.b}
                  color={checkBar.ok ? "#8ee08a" : "#ff8a7a"}
                  label={`conferir · ${checkBar.meters.toFixed(checkBar.meters % 1 ? 2 : 0)} m${checkBar.ok ? " · ok" : ""}`}
                  ui={ui}
                />
              )}
              {headingPoints.length > 0 && (
                <g>
                  {headingPoints.length === 2 && (
                    <line
                      x1={headingPoints[0][0]}
                      y1={headingPoints[0][1]}
                      x2={headingPoints[1][0]}
                      y2={headingPoints[1][1]}
                      stroke="#7ec8ff"
                      strokeWidth={2.4 * ui}
                    />
                  )}
                  {headingPoints.map((pt, i) => (
                    <circle
                      key={`heading-${i}`}
                      cx={pt[0]}
                      cy={pt[1]}
                      r={((state.tool === "heading" && overScaleHandle === i ? 6 : 4.5)) * ui}
                      fill={state.tool === "heading" && overScaleHandle === i ? "#e8f6ff" : "#7ec8ff"}
                      stroke="#1a1408"
                      strokeWidth={1.2 * ui}
                    />
                  ))}
                  {headingPoints.length === 2 && (
                    <text
                      x={(headingPoints[0][0] + headingPoints[1][0]) / 2}
                      y={(headingPoints[0][1] + headingPoints[1][1]) / 2 - 12 * ui}
                      fill="#7ec8ff"
                      fontSize={12 * ui}
                      fontWeight={700}
                      textAnchor="middle"
                    >
                      {state.scale.heading
                        ? `muro / divisa · ${state.scale.heading.azimuth_deg.toFixed(1)}° · desvio ${(state.scale.heading.azimuth_deg - 90).toFixed(1)}°`
                        : "muro / divisa"}
                    </text>
                  )}
                </g>
              )}
              {moduleTape && (
                <g>
                  <ScaleDimension
                    a={[moduleTape.x, moduleTape.y]}
                    b={[moduleTape.x + moduleTape.w, moduleTape.y]}
                    color="#8ee08a"
                    label={`largura ${moduleTape.width_m.toFixed(3)} m`}
                    ui={ui}
                  />
                  <ScaleDimension
                    a={[moduleTape.x + moduleTape.w, moduleTape.y]}
                    b={[moduleTape.x + moduleTape.w, moduleTape.y + moduleTape.h]}
                    color="#5ec8d6"
                    label={`altura ${moduleTape.height_m.toFixed(3)} m`}
                    ui={ui}
                  />
                </g>
              )}
              {state.ruler && !moduleTape && (
                <g>
                  <line
                    x1={state.ruler.a[0]}
                    y1={state.ruler.a[1]}
                    x2={state.ruler.b[0]}
                    y2={state.ruler.b[1]}
                    stroke={measured?.match.ok ? "#8ee08a" : "#5ec8d6"}
                    strokeWidth={2 * ui}
                  />
                  <circle cx={state.ruler.a[0]} cy={state.ruler.a[1]} r={4 * ui} fill="#5ec8d6" />
                  <circle cx={state.ruler.b[0]} cy={state.ruler.b[1]} r={4 * ui} fill="#5ec8d6" />
                  {Math.hypot(state.ruler.b[0] - state.ruler.a[0], state.ruler.b[1] - state.ruler.a[1]) > 4 && (
                    <text
                      x={(state.ruler.a[0] + state.ruler.b[0]) / 2}
                      y={(state.ruler.a[1] + state.ruler.b[1]) / 2 - 10 * ui}
                      fill={measured?.match.ok ? "#8ee08a" : "#5ec8d6"}
                      fontSize={13 * ui}
                      fontWeight={700}
                      textAnchor="middle"
                    >
                      {measured
                        ? `${measured.meters.toFixed(3)} m · `
                        : ""}
                      azimute {lineAzimuthDeg(state.ruler.a, state.ruler.b).toFixed(1)}°
                    </text>
                  )}
                </g>
              )}
            </svg>
          </div>
        )}
        {!image && <div className="busy">Importe a imagem do telhado para começar</div>}
        {state.busy && <div className="busy">Calculando layout…</div>}
      </div>
    </div>
  );
}
