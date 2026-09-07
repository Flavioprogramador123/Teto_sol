import type {
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
  offsetPolygon,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  modulesCollide,
  polygonsTouchOrOverlap,
  rectPolygon,
  rectsOverlapWithGap,
} from "./geometry";
import { polyMToPx, polyPxToM } from "./scale";
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

export interface LayoutInput {
  areas: RoofArea[];
  obstacles: Obstacle[];
  module: ModuleSpec;
  meters_per_pixel: number;
  grid_step_m: number;
}

interface Candidate {
  x: number;
  y: number;
  w: number;
  h: number;
  rect: Pt[];
}

function orientationsOf(module: ModuleSpec, allowed: ModuleOrientation[]): Array<{
  orientation: ModuleOrientation;
  w: number;
  h: number;
}> {
  const both: Array<{ orientation: ModuleOrientation; w: number; h: number }> = [
    { orientation: "paisagem", w: module.width_m, h: module.height_m },
    { orientation: "retrato", w: module.height_m, h: module.width_m },
  ];
  const filtered = both.filter((o) => allowed.includes(o.orientation));
  if (!module.rotation_allowed) {
    return filtered.filter((o) => o.orientation === "paisagem");
  }
  return filtered.length ? filtered : both;
}

function selectWithoutOverlap(candidates: Candidate[], quantity: number, gap: number): Candidate[] {
  const picked: Candidate[] = [];
  for (const c of candidates) {
    if (picked.length >= quantity) break;
    const fits = picked.every((p) => !rectsOverlapWithGap(p, c, gap));
    if (fits) picked.push(c);
  }
  return picked;
}

function evaluateArea(
  area: RoofArea,
  usable_m: Pt[],
  obstacles_m: Pt[][],
  module: ModuleSpec,
  step: number,
): LayoutSolution[] {
  const allowed = area.allowed_orientations.length
    ? area.allowed_orientations
    : (["paisagem", "retrato"] as ModuleOrientation[]);
  const oris = orientationsOf(module, allowed);
  const gridDeg = roofGridDeg(area);
  const pivot = roofPivot(usable_m);
  const usableR = rotatePoly(usable_m, pivot, -gridDeg);
  const obstaclesR = obstacles_m.map((p) => rotatePoly(p, pivot, -gridDeg));
  const baseFrame = surfaceFrame(area, usableR);
  const frame =
    Math.abs(gridDeg) > 1e-6
      ? { ...baseFrame, axis: "x" as const, origin: usableR.length ? Math.min(...usableR.map((p) => p[0])) : baseFrame.origin }
      : baseFrame;
  const usableS = transformPoly(usableR, frame.axis, frame.origin, frame.toSurface);
  const obstaclesS = obstaclesR.map((p) => transformPoly(p, frame.axis, frame.origin, frame.toSurface));
  const bbox = boundingBox(usableS);
  const solutions: LayoutSolution[] = [];
  const spanX = Math.max(0, bbox.maxX - bbox.minX);
  const spanY = Math.max(0, bbox.maxY - bbox.minY);
  const rawCells = Math.ceil(spanX / Math.max(step, 0.01)) * Math.ceil(spanY / Math.max(step, 0.01));
  const usedStep = rawCells > 80000 ? Math.max(step, Math.sqrt((spanX * spanY) / 80000)) : step;
  const sample = Math.max(usedStep, Math.min(module.width_m, module.height_m) / 6);

  for (const ori of oris) {
    const candidates: Candidate[] = [];
    let rejected_outside = 0;
    let rejected_obstacle = 0;
    let tested = 0;

    for (let y = bbox.minY; y <= bbox.maxY - ori.h + 1e-9; y += usedStep) {
      for (let x = bbox.minX; x <= bbox.maxX - ori.w + 1e-9; x += usedStep) {
        tested += 1;
        const rect = rectPolygon(x, y, ori.w, ori.h);
        if (!denseInside(rect, usableS, sample)) {
          rejected_outside += 1;
          continue;
        }
        if (obstaclesS.some((obs) => polygonsTouchOrOverlap(rect, obs))) {
          rejected_obstacle += 1;
          continue;
        }
        candidates.push({ x, y, w: ori.w, h: ori.h, rect });
      }
    }

    const selected = selectWithoutOverlap(candidates, module.quantity_target, module.gap_m);
    const used = selected.length * ori.w * ori.h;
    const idle = Math.max(0, Math.abs(polygonArea(usable_m)) - used);
    const grid_offset_m = selected.reduce((s, m) => s + m.x + m.y, 0);
    const score = selected.length * 100000 - idle - grid_offset_m;

    solutions.push({
      orientation: ori.orientation,
      modules: selected.map((m) => {
        const plan = transformRect(m, frame.axis, frame.origin, frame.toPlan);
        const world = localRectToWorld(plan, pivot, gridDeg);
        return {
          id: uid("mod"),
          x_m: world.x,
          y_m: world.y,
          width_m: world.w,
          height_m: world.h,
          orientation: ori.orientation,
          rotation_deg: world.rotation_deg,
          source: "auto" as const,
          violation: null,
          area_id: area.id,
        };
      }),
      score,
      idle_area_m2: idle,
      grid_offset_m,
      candidates_tested: tested,
      accepted_candidates: candidates.length,
      rejected_outside,
      rejected_obstacle,
    });
  }
  return solutions;
}

export function generateLayout(input: LayoutInput): LayoutResult {
  const { areas, obstacles, module, meters_per_pixel, grid_step_m } = input;
  const activeAreas = areas.filter((a) => a.active && a.polygon_px.length >= 3);
  const usable_polygons_px: LayoutResult["usable_polygons_px"] = [];
  const allSolutions: LayoutSolution[] = [];
  const perAreaBest: LayoutSolution[] = [];

  const expandedObstacles_m: Pt[][] = [];
  for (const obs of obstacles) {
    if (!obs.excluded || obs.polygon_px.length < 3) continue;
    const poly_m = polyPxToM(obs.polygon_px, meters_per_pixel);
    const expanded = offsetPolygon(poly_m, obs.safety_margin_m);
    expandedObstacles_m.push(expanded ?? poly_m);
  }

  for (const area of activeAreas) {
    const area_m = polyPxToM(area.polygon_px, meters_per_pixel);
    const usable = offsetPolygon(area_m, -area.margin_m);
    if (!usable) {
      usable_polygons_px.push({
        areaId: area.id,
        polygon_px: [],
        error: `A área «${area.name}» ficou menor que o afastamento mínimo de ${area.margin_m.toFixed(2)} m.`,
      });
      continue;
    }
    usable_polygons_px.push({
      areaId: area.id,
      polygon_px: polyMToPx(usable, meters_per_pixel),
    });
    const local = evaluateArea(area, usable, expandedObstacles_m, module, grid_step_m);
    allSolutions.push(...local);
    local.sort((a, b) => {
      if (b.modules.length !== a.modules.length) return b.modules.length - a.modules.length;
      return b.score - a.score;
    });
    if (local[0]) perAreaBest.push(local[0]);
  }

  if (!allSolutions.length) {
    return {
      status: "Impossível",
      installed: 0,
      requested: module.quantity_target,
      missing: module.quantity_target,
      power_wp: 0,
      power_kwp: 0,
      occupied_area_m2: 0,
      best: emptySolution(),
      alternatives: [],
      usable_polygons_px,
      computed_at: Date.now(),
    };
  }

  allSolutions.sort((a, b) => {
    if (b.modules.length !== a.modules.length) return b.modules.length - a.modules.length;
    return b.score - a.score;
  });

  const best = combinePerArea(perAreaBest, module.quantity_target, module.gap_m);
  const installed = best.modules.length;
  const power_wp = installed * module.power_w;
  const occupied = best.modules.reduce((s, m) => s + m.width_m * m.height_m, 0);
  const status =
    installed === 0 ? "Impossível" : installed >= module.quantity_target ? "Aprovado" : "Parcial";

  return {
    status,
    installed,
    requested: module.quantity_target,
    missing: Math.max(0, module.quantity_target - installed),
    power_wp,
    power_kwp: power_wp / 1000,
    occupied_area_m2: occupied,
    best,
    alternatives: allSolutions,
    usable_polygons_px,
    computed_at: Date.now(),
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

function combinePerArea(solutions: LayoutSolution[], target: number, gap: number): LayoutSolution {
  if (!solutions.length) return emptySolution();
  const modules: LayoutSolution["modules"] = [];
  let candidates_tested = 0;
  let accepted_candidates = 0;
  let rejected_outside = 0;
  let rejected_obstacle = 0;
  let idle_area_m2 = 0;
  let grid_offset_m = 0;
  for (const s of solutions) {
    candidates_tested += s.candidates_tested;
    accepted_candidates += s.accepted_candidates;
    rejected_outside += s.rejected_outside;
    rejected_obstacle += s.rejected_obstacle;
    idle_area_m2 += s.idle_area_m2;
    grid_offset_m += s.grid_offset_m;
    for (const m of s.modules) {
      if (modules.length >= target) break;
      if (modules.some((o) => modulesCollide(m, o, gap))) continue;
      modules.push(m);
    }
  }
  return {
    orientation: solutions[0].orientation,
    modules,
    score: modules.length * 100000 - idle_area_m2 - grid_offset_m,
    idle_area_m2,
    grid_offset_m,
    candidates_tested,
    accepted_candidates,
    rejected_outside,
    rejected_obstacle,
  };
}

export function validatePlacement(
  moduleRect_m: Pt[],
  areas: RoofArea[],
  obstacles: Obstacle[],
  meters_per_pixel: number,
  gap_m: number,
  others: PlacedModule[],
  selfId: string,
): string | null {
  const hosts = areas
    .filter((a) => a.active && a.polygon_px.length >= 3)
    .map((area) => {
      const poly = polyPxToM(area.polygon_px, meters_per_pixel);
      // Folga maior na borda: módulo rotacionado no limite gerava falso «fora da área»
      const room = offsetPolygon(poly, 0.08) ?? poly;
      return { area, poly, room };
    });
  const host = hosts.find((h) => denseInside(moduleRect_m, h.room, 0.12));
  if (!host) return "Fora da área útil.";

  for (const obs of obstacles) {
    if (!obs.excluded || obs.polygon_px.length < 3) continue;
    const poly = polyPxToM(obs.polygon_px, meters_per_pixel);
    const onRoof = pointInPolygon(polygonCentroid(poly), host.poly);
    const block = onRoof && obs.safety_margin_m > 0 ? offsetPolygon(poly, obs.safety_margin_m) ?? poly : poly;
    if (polygonsTouchOrOverlap(moduleRect_m, block)) {
      return `Intercepta o obstáculo «${obs.name}».`;
    }
  }

  // Tolera ~2 mm no vão (empacotamento / float) — evita vermelho falso entre vizinhos
  const gapCheck = Math.max(0, gap_m - 0.002);
  const self = others.find((o) => o.id === selfId);
  if (self) {
    for (const other of others) {
      if (other.id === selfId) continue;
      if (modulesCollide(self, other, gapCheck)) {
        return "Sobrepõe outro módulo (incluindo o vão).";
      }
    }
  } else {
    const box = {
      x_m: Math.min(...moduleRect_m.map((p) => p[0])),
      y_m: Math.min(...moduleRect_m.map((p) => p[1])),
      width_m: 0,
      height_m: 0,
      rotation_deg: 0 as number,
    };
    const maxX = Math.max(...moduleRect_m.map((p) => p[0]));
    const maxY = Math.max(...moduleRect_m.map((p) => p[1]));
    box.width_m = maxX - box.x_m;
    box.height_m = maxY - box.y_m;
    for (const other of others) {
      if (other.id === selfId) continue;
      if (modulesCollide(box, other, gapCheck)) {
        return "Sobrepõe outro módulo (incluindo o vão).";
      }
    }
  }
  return null;
}
