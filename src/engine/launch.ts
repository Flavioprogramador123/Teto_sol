import type {
  LaunchMode,
  LaunchZone,
  LayoutResult,
  LayoutSolution,
  ModuleOrientation,
  ModuleSpec,
  Obstacle,
  PlacedModule,
  Pt,
  RoofArea,
} from "../types";
import {
  boundingBox,
  denseInside,
  modulePolygon,
  modulesCollide,
  offsetPolygon,
  pointInPolygon,
  polygonCentroid,
  polygonsTouchOrOverlap,
  rectPolygon,
  rectsOverlapWithGap,
} from "./geometry";
import { polyPxToM } from "./scale";
import { uid } from "../lib/id";
import {
  localRectToWorld,
  roofGridDeg,
  roofPivot,
  rotatePoly,
  surfaceFrame,
  transformPoly,
  transformRect,
} from "./roofPlane";

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: ModuleOrientation;
}

function bboxOverlapArea(a: Pt[], b: Pt[]): number {
  const A = boundingBox(a);
  const B = boundingBox(b);
  const w = Math.max(0, Math.min(A.maxX, B.maxX) - Math.max(A.minX, B.minX));
  const h = Math.max(0, Math.min(A.maxY, B.maxY) - Math.max(A.minY, B.minY));
  return w * h;
}

function obstaclePolysForArea(obstacles: Obstacle[], area_m: Pt[], mpp: number): Pt[][] {
  const out: Pt[][] = [];
  for (const obs of obstacles) {
    if (!obs.excluded || obs.polygon_px.length < 3) continue;
    const poly = polyPxToM(obs.polygon_px, mpp);
    if (!polygonsTouchOrOverlap(poly, area_m)) continue;
    const onRoof = pointInPolygon(polygonCentroid(poly), area_m);
    if (onRoof && obs.safety_margin_m > 0) {
      out.push(offsetPolygon(poly, obs.safety_margin_m) ?? poly);
    } else {
      out.push(poly);
    }
  }
  return out;
}

function inferArea(launch_m: Pt[], areas: RoofArea[], mpp: number): { area: RoofArea; usable: Pt[] } | null {
  let best: { area: RoofArea; usable: Pt[]; score: number } | null = null;
  for (const area of areas) {
    if (!area.active || area.polygon_px.length < 3) continue;
    const area_m = polyPxToM(area.polygon_px, mpp);
    if (!polygonsTouchOrOverlap(launch_m, area_m)) continue;
    const overlap = bboxOverlapArea(launch_m, area_m);
    if (!best || overlap > best.score) best = { area, usable: area_m, score: overlap };
  }
  return best ? { area: best.area, usable: best.usable } : null;
}

function validCell(
  x: number,
  y: number,
  w: number,
  h: number,
  launch: Pt[],
  usable: Pt[],
  obstacles: Pt[][],
  occupied: Array<{ x: number; y: number; w: number; h: number }>,
  gap: number,
  sample: number,
): boolean {
  const rect = rectPolygon(x, y, w, h);
  if (!denseInside(rect, launch, sample)) return false;
  if (!denseInside(rect, usable, sample)) return false;
  if (obstacles.some((obs) => polygonsTouchOrOverlap(rect, obs))) return false;
  if (occupied.some((o) => rectsOverlapWithGap({ x, y, w, h }, o, gap))) return false;
  return true;
}

function consecutiveRuns(values: number[], pitch: number): number[][] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const runs: number[][] = [[sorted[0]]];
  const tol = Math.max(0.02, pitch * 0.08);
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i] - sorted[i - 1] - pitch) <= tol) {
      runs[runs.length - 1].push(sorted[i]);
    } else {
      runs.push([sorted[i]]);
    }
  }
  return runs;
}

function chooseRuns(runs: number[][], mode: LaunchMode): number[][] {
  if (!runs.length) return [];
  if (mode === "fracionada") return runs;
  if (mode === "mista") {
    const multi = runs.filter((r) => r.length >= 2);
    const singles = runs.filter((r) => r.length === 1);
    if (multi.length) return [...multi, ...singles.slice(0, 1)];
    return singles.slice(0, 1);
  }
  const longest = Math.max(...runs.map((r) => r.length));
  return runs.filter((r) => r.length === longest);
}

/**
 * AABB no frame de packing a partir do polígono real (com azimute).
 * Evita subestimar a ocupação quando rotation_deg ≠ 0.
 */
function occupiedInSurfaceFrame(
  modules: PlacedModule[],
  pivot: Pt,
  gridDeg: number,
  frame: { axis: "x" | "y"; origin: number; toSurface: number },
): Array<{ x: number; y: number; w: number; h: number }> {
  return modules.map((m) => {
    const local = rotatePoly(modulePolygon(m), pivot, -gridDeg);
    const surface = transformPoly(local, frame.axis, frame.origin, frame.toSurface);
    const bb = boundingBox(surface);
    return {
      x: bb.minX,
      y: bb.minY,
      w: Math.max(0, bb.maxX - bb.minX),
      h: Math.max(0, bb.maxY - bb.minY),
    };
  });
}

function acceptNonOverlapping(
  candidates: PlacedModule[],
  occupied: PlacedModule[],
  gap: number,
): PlacedModule[] {
  const kept: PlacedModule[] = [];
  const pool = [...occupied];
  for (const m of candidates) {
    if (pool.some((o) => modulesCollide(m, o, gap))) continue;
    kept.push(m);
    pool.push(m);
  }
  return kept;
}

function packSpace(
  launch_m: Pt[],
  usable: Pt[],
  obstacles: Pt[][],
  occupied: PlacedModule[],
  area: RoofArea,
) {
  const gridDeg = roofGridDeg(area);
  const pivot = roofPivot(usable);
  const launchR = rotatePoly(launch_m, pivot, -gridDeg);
  const usableR = rotatePoly(usable, pivot, -gridDeg);
  const obsR = obstacles.map((p) => rotatePoly(p, pivot, -gridDeg));
  const frame = surfaceFrame(area, usableR);
  const aligned = Math.abs(gridDeg) > 1e-6 ? { ...frame, axis: "x" as const, origin: usableR.length ? Math.min(...usableR.map((p) => p[0])) : frame.origin } : frame;
  const launchS = transformPoly(launchR, aligned.axis, aligned.origin, aligned.toSurface);
  const usableS = transformPoly(usableR, aligned.axis, aligned.origin, aligned.toSurface);
  const obsS = obsR.map((p) => transformPoly(p, aligned.axis, aligned.origin, aligned.toSurface));
  const taken = occupiedInSurfaceFrame(occupied, pivot, gridDeg, aligned);
  return { gridDeg, pivot, frame: aligned, launchS, usableS, obsS, taken };
}

function cellToModule(
  c: Cell,
  frame: { axis: "x" | "y"; origin: number; toPlan: number },
  pivot: Pt,
  gridDeg: number,
  launch_id: string,
  area_id: string,
  source: "auto" | "manual",
): PlacedModule {
  const plan = transformRect(c, frame.axis, frame.origin, frame.toPlan);
  const world = localRectToWorld(plan, pivot, gridDeg);
  return {
    id: uid("mod"),
    x_m: world.x,
    y_m: world.y,
    width_m: world.w,
    height_m: world.h,
    orientation: c.orientation,
    rotation_deg: world.rotation_deg,
    source,
    violation: null,
    launch_id,
    area_id,
  };
}

function uniqueOffsets(list: Array<[number, number]>): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const [x, y] of list) {
    const key = `${x.toFixed(4)},${y.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([x, y]);
  }
  return out;
}

function packFromOrigin(
  launch: Pt[],
  usable: Pt[],
  obstacles: Pt[][],
  occupied: Array<{ x: number; y: number; w: number; h: number }>,
  w: number,
  h: number,
  gap: number,
  orientation: ModuleOrientation,
  mode: LaunchMode,
  axis: "row" | "col",
  sample: number,
  originX: number,
  originY: number,
  maxX: number,
  maxY: number,
): Cell[] {
  const px = w + gap;
  const py = h + gap;
  const picked: Cell[] = [];

  if (axis === "row") {
    for (let y = originY; y + h <= maxY + 1e-9; y += py) {
      const xs: number[] = [];
      for (let x = originX; x + w <= maxX + 1e-9; x += px) {
        if (validCell(x, y, w, h, launch, usable, obstacles, occupied, gap, sample)) xs.push(x);
      }
      for (const run of chooseRuns(consecutiveRuns(xs, px), mode)) {
        for (const x of run) picked.push({ x, y, w, h, orientation });
      }
    }
    return picked;
  }

  for (let x = originX; x + w <= maxX + 1e-9; x += px) {
    const ys: number[] = [];
    for (let y = originY; y + h <= maxY + 1e-9; y += py) {
      if (validCell(x, y, w, h, launch, usable, obstacles, occupied, gap, sample)) ys.push(y);
    }
    for (const run of chooseRuns(consecutiveRuns(ys, py), mode)) {
      for (const y of run) picked.push({ x, y, w, h, orientation });
    }
  }
  return picked;
}

function packAxis(
  launch: Pt[],
  usable: Pt[],
  obstacles: Pt[][],
  w: number,
  h: number,
  gap: number,
  orientation: ModuleOrientation,
  mode: LaunchMode,
  axis: "row" | "col",
  occupied: Array<{ x: number; y: number; w: number; h: number }>,
): Cell[] {
  const launchBox = boundingBox(launch);
  const clipBox = boundingBox(usable);
  const minX = Math.max(launchBox.minX, clipBox.minX);
  const minY = Math.max(launchBox.minY, clipBox.minY);
  const maxX = Math.min(launchBox.maxX, clipBox.maxX);
  const maxY = Math.min(launchBox.maxY, clipBox.maxY);
  if (maxX - minX < w - 1e-9 || maxY - minY < h - 1e-9) return [];

  const sample = Math.max(0.12, Math.min(w, h) / 5);
  const px = w + gap;
  const py = h + gap;
  const leftoverX = Math.max(0, ((maxX - minX - w) % px + px) % px);
  const leftoverY = Math.max(0, ((maxY - minY - h) % py + py) % py);
  const offsets = uniqueOffsets([
    [0, 0],
    [leftoverX / 2, leftoverY / 2],
    [leftoverX, leftoverY / 2],
    [leftoverX / 2, leftoverY],
    [leftoverX, leftoverY],
    [Math.min(0.15, leftoverX), 0],
    [0, Math.min(0.15, leftoverY)],
    [Math.min(0.3, leftoverX), Math.min(0.15, leftoverY)],
  ]);

  let best: Cell[] = [];
  let bestScore = -Infinity;
  for (const [ox, oy] of offsets) {
    const cells = packFromOrigin(
      launch,
      usable,
      obstacles,
      occupied,
      w,
      h,
      gap,
      orientation,
      mode,
      axis,
      sample,
      minX + ox,
      minY + oy,
      maxX,
      maxY,
    );
    const centered = Math.abs(ox - leftoverX / 2) + Math.abs(oy - leftoverY / 2);
    const score = cells.length * 10000 - centered;
    if (score > bestScore) {
      bestScore = score;
      best = cells;
    }
  }
  return best;
}

function regularity(cells: Cell[]): number {
  const rows = new Map<string, number>();
  for (const c of cells) {
    const key = c.y.toFixed(3);
    rows.set(key, (rows.get(key) ?? 0) + 1);
  }
  const lengths = [...rows.values()];
  if (!lengths.length) return 0;
  const max = Math.max(...lengths);
  return lengths.filter((n) => n === max).length * 100 + max - lengths.filter((n) => n === 1).length;
}

export function packOrientedPolygon(
  launch_px: Pt[],
  orientation: ModuleOrientation,
  areas: RoofArea[],
  obstacles: Obstacle[],
  module: ModuleSpec,
  meters_per_pixel: number,
  launch_id: string,
  occupied: PlacedModule[] = [],
): { modules: PlacedModule[]; area_id: string | null; error?: string } {
  if (launch_px.length < 3) return { modules: [], area_id: null, error: "Retângulo de lançamento incompleto." };
  const launch_m = polyPxToM(launch_px, meters_per_pixel);
  const found = inferArea(launch_m, areas, meters_per_pixel);
  if (!found) {
    return { modules: [], area_id: null, error: "Abra o retângulo sobre a área útil (verde)." };
  }
  const obs = obstaclePolysForArea(obstacles, found.usable, meters_per_pixel);
  const space = packSpace(launch_m, found.usable, obs, occupied, found.area);
  const w = orientation === "paisagem" ? module.width_m : module.height_m;
  const h = orientation === "paisagem" ? module.height_m : module.width_m;
  const packGap = module.gap_m + 1e-3;
  const row = packAxis(space.launchS, space.usableS, space.obsS, w, h, packGap, orientation, "fracionada", "row", space.taken);
  const col = packAxis(space.launchS, space.usableS, space.obsS, w, h, packGap, orientation, "fracionada", "col", space.taken);
  const best = row.length >= col.length ? row : col;
  const candidates = best.map((c) =>
    cellToModule(c, space.frame, space.pivot, space.gridDeg, launch_id, found.area.id, "manual"),
  );
  return {
    area_id: found.area.id,
    modules: acceptNonOverlapping(candidates, occupied, module.gap_m),
  };
}

export function packLaunchPolygon(
  launch_px: Pt[],
  mode: LaunchMode,
  areas: RoofArea[],
  obstacles: Obstacle[],
  module: ModuleSpec,
  meters_per_pixel: number,
  launch_id: string,
  occupied: PlacedModule[] = [],
): { modules: PlacedModule[]; area_id: string | null; error?: string } {
  if (launch_px.length < 3) return { modules: [], area_id: null, error: "Polígono de lançamento incompleto." };
  const launch_m = polyPxToM(launch_px, meters_per_pixel);
  const found = inferArea(launch_m, areas, meters_per_pixel);
  if (!found) {
    return { modules: [], area_id: null, error: "Abra o polígono de lançamento sobre uma área útil." };
  }
  const obs = obstaclePolysForArea(obstacles, found.usable, meters_per_pixel);
  const space = packSpace(launch_m, found.usable, obs, occupied, found.area);
  const oris: Array<{ orientation: ModuleOrientation; w: number; h: number }> = [
    { orientation: "paisagem", w: module.width_m, h: module.height_m },
    { orientation: "retrato", w: module.height_m, h: module.width_m },
  ];
  const allowed = module.rotation_allowed ? oris : oris.filter((o) => o.orientation === "paisagem");
  const packGap = module.gap_m + 1e-3;
  let best: Cell[] = [];
  let bestScore = -1;
  for (const ori of allowed) {
    for (const axis of ["row", "col"] as const) {
      const cells = packAxis(space.launchS, space.usableS, space.obsS, ori.w, ori.h, packGap, ori.orientation, mode, axis, space.taken);
      const score = cells.length * 10000 + regularity(cells);
      if (score > bestScore) {
        bestScore = score;
        best = cells;
      }
    }
  }
  const candidates = best.map((c) =>
    cellToModule(c, space.frame, space.pivot, space.gridDeg, launch_id, found.area.id, "auto"),
  );
  return {
    modules: acceptNonOverlapping(candidates, occupied, module.gap_m),
    area_id: found.area.id,
  };
}

function emptySolution(): LayoutSolution {
  return {
    orientation: "paisagem",
    modules: [],
    score: 0,
    idle_area_m2: 0,
    grid_offset_m: 0,
    candidates_tested: 0,
    accepted_candidates: 0,
    rejected_outside: 0,
    rejected_obstacle: 0,
  };
}

export function layoutFromLaunchModules(modules: PlacedModule[], spec: ModuleSpec): LayoutResult {
  const installed = modules.length;
  const power_wp = installed * spec.power_w;
  const occupied = modules.reduce((s, m) => s + m.width_m * m.height_m, 0);
  const status = installed === 0 ? "Impossível" : installed >= spec.quantity_target ? "Aprovado" : "Parcial";
  const best: LayoutSolution = {
    ...emptySolution(),
    orientation: modules[0]?.orientation ?? "paisagem",
    modules,
    score: installed * 100000,
    accepted_candidates: installed,
  };
  return {
    status,
    installed,
    requested: spec.quantity_target,
    missing: Math.max(0, spec.quantity_target - installed),
    power_wp,
    power_kwp: power_wp / 1000,
    occupied_area_m2: occupied,
    best,
    alternatives: [],
    usable_polygons_px: [],
    computed_at: Date.now(),
  };
}

/**
 * Ordena módulos em sequência de leitura no rumo do telhado (linha → coluna).
 * Assim os números 1…N ficam contínuos no mapa após «Atualizar usina».
 */
export function sortModulesReadingOrder(modules: PlacedModule[]): PlacedModule[] {
  if (modules.length <= 1) return modules;
  const gridDeg =
    modules.reduce((s, m) => s + (m.rotation_deg ?? 0), 0) / modules.length;
  const rad = (-gridDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rowPitch =
    modules.reduce((s, m) => s + Math.min(m.width_m, m.height_m), 0) / modules.length;
  const rowTol = Math.max(0.15, rowPitch * 0.45);

  const keyed = modules.map((m) => {
    const cx = m.x_m + m.width_m / 2;
    const cy = m.y_m + m.height_m / 2;
    return {
      m,
      lx: cx * cos - cy * sin,
      ly: cx * sin + cy * cos,
    };
  });
  keyed.sort((a, b) => {
    if (Math.abs(a.ly - b.ly) > rowTol) return a.ly - b.ly;
    return a.lx - b.lx;
  });
  return keyed.map((k) => k.m);
}

export function packAllLaunches(
  launches: LaunchZone[],
  areas: RoofArea[],
  obstacles: Obstacle[],
  module: ModuleSpec,
  meters_per_pixel: number,
): { layout: LayoutResult; error?: string } {
  const modules: PlacedModule[] = [];
  let error: string | undefined;
  for (const zone of launches) {
    const packed = zone.orientation
      ? packOrientedPolygon(zone.polygon_px, zone.orientation, areas, obstacles, module, meters_per_pixel, zone.id, modules)
      : packLaunchPolygon(zone.polygon_px, zone.mode, areas, obstacles, module, meters_per_pixel, zone.id, modules);
    if (packed.error && !error) error = packed.error;
    modules.push(...packed.modules);
  }
  return { layout: layoutFromLaunchModules(modules, module), error };
}
