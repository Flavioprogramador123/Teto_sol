import type { Pt, RoofArea, RoofPlane } from "../types";
import { lineAzimuthDeg } from "./scale";

export const DEFAULT_ROOF_PLANE: RoofPlane = {
  slope_percent: 0,
  slope_angle_deg: 0,
  fall_direction_deg: 90,
  material: "",
  tile_model: "",
  slope_source: "manual",
  slope_confidence: "unconfirmed",
  projection_mode: "orthographic",
};

export function slopeToAngle(slope_percent: number): number {
  return Math.atan(Math.max(0, slope_percent) / 100);
}

export function slopeToDegrees(slope_percent: number): number {
  return (slopeToAngle(slope_percent) * 180) / Math.PI;
}

export function surfaceFactor(slope_percent: number): number {
  const cos = Math.cos(slopeToAngle(slope_percent));
  return cos > 1e-9 ? 1 / cos : 1;
}

export function projectedLength(surface_m: number, slope_percent: number): number {
  return surface_m * Math.cos(slopeToAngle(slope_percent));
}

export function surfaceLength(plan_m: number, slope_percent: number): number {
  return plan_m * surfaceFactor(slope_percent);
}

export function normalizeRoofPlane(plane?: RoofPlane | null): RoofPlane {
  const slope = Math.max(0, plane?.slope_percent ?? 0);
  return {
    ...DEFAULT_ROOF_PLANE,
    ...plane,
    slope_percent: slope,
    slope_angle_deg: slopeToDegrees(slope),
  };
}

export function roofPlaneOf(area: RoofArea): RoofPlane {
  const plane = normalizeRoofPlane(area.roof_plane);
  if (area.azimuth_deg != null && Number.isFinite(area.azimuth_deg)) {
    return { ...plane, fall_direction_deg: area.azimuth_deg };
  }
  return plane;
}

export function roofAzimuthDeg(area: RoofArea): number {
  if (area.azimuth_deg != null && Number.isFinite(area.azimuth_deg)) return area.azimuth_deg;
  return roofPlaneOf(area).fall_direction_deg;
}

/** Giro da grade na figura: 90° (leste) = horizontal; 93° = 3° de desvio. */
export function azimuthToGridDeg(azimuth_deg: number): number {
  let d = azimuth_deg - 90;
  d = ((d % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

export function roofGridDeg(area: RoofArea): number {
  return azimuthToGridDeg(roofAzimuthDeg(area));
}

/**
 * Azimute da aresta mais longa do polígono (fileira/cumeeira desenhada na figura).
 * Escolhe o sentido (0° ou +180°) mais próximo de `preferNear` quando informado.
 */
export function dominantEdgeAzimuthDeg(poly: Pt[], preferNear?: number | null): number {
  if (poly.length < 2) return preferNear ?? 90;
  const dist = (a: number, b: number) => {
    let d = Math.abs((((a - b) % 360) + 360) % 360);
    if (d > 180) d = 360 - d;
    return d;
  };
  let bestLen = 0;
  let bestAz = preferNear ?? 90;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len <= bestLen) continue;
    bestLen = len;
    let az = lineAzimuthDeg(a, b);
    if (preferNear != null && Number.isFinite(preferNear)) {
      const alt = (az + 180) % 360;
      if (dist(alt, preferNear) < dist(az, preferNear)) az = alt;
    }
    bestAz = az;
  }
  return Number(bestAz.toFixed(1));
}

export function roofPivot(points: Pt[]): Pt {
  if (!points.length) return [0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

export function rotateAround(p: Pt, origin: Pt, deg: number): Pt {
  if (Math.abs(deg) < 1e-9) return p;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const x = p[0] - origin[0];
  const y = p[1] - origin[1];
  return [origin[0] + x * c - y * s, origin[1] + x * s + y * c];
}

export function rotatePoly(points: Pt[], origin: Pt, deg: number): Pt[] {
  if (Math.abs(deg) < 1e-9) return points;
  return points.map((p) => rotateAround(p, origin, deg));
}

export function localRectToWorld(
  rect: { x: number; y: number; w: number; h: number },
  pivot: Pt,
  gridDeg: number,
): { x: number; y: number; w: number; h: number; rotation_deg: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const [wx, wy] = rotateAround([cx, cy], pivot, gridDeg);
  return { x: wx - rect.w / 2, y: wy - rect.h / 2, w: rect.w, h: rect.h, rotation_deg: gridDeg };
}

export function worldRectToLocal(
  rect: { x: number; y: number; w: number; h: number },
  pivot: Pt,
  gridDeg: number,
): { x: number; y: number; w: number; h: number } {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const [lx, ly] = rotateAround([cx, cy], pivot, -gridDeg);
  return { x: lx - rect.w / 2, y: ly - rect.h / 2, w: rect.w, h: rect.h };
}

export function fallAxis(fall_direction_deg: number): "x" | "y" {
  const a = ((fall_direction_deg % 180) + 180) % 180;
  return a < 45 || a > 135 ? "y" : "x";
}

export function axisOrigin(points: Pt[], axis: "x" | "y"): number {
  if (!points.length) return 0;
  return axis === "x" ? Math.min(...points.map((p) => p[0])) : Math.min(...points.map((p) => p[1]));
}

function scaleCoord(value: number, origin: number, factor: number): number {
  return origin + (value - origin) * factor;
}

export function transformPoly(points: Pt[], axis: "x" | "y", origin: number, factor: number): Pt[] {
  return points.map(([x, y]) =>
    axis === "x" ? [scaleCoord(x, origin, factor), y] : [x, scaleCoord(y, origin, factor)],
  );
}

export function transformRect(
  rect: { x: number; y: number; w: number; h: number },
  axis: "x" | "y",
  origin: number,
  factor: number,
): { x: number; y: number; w: number; h: number } {
  if (axis === "x") {
    const x0 = scaleCoord(rect.x, origin, factor);
    const x1 = scaleCoord(rect.x + rect.w, origin, factor);
    return { x: Math.min(x0, x1), y: rect.y, w: Math.abs(x1 - x0), h: rect.h };
  }
  const y0 = scaleCoord(rect.y, origin, factor);
  const y1 = scaleCoord(rect.y + rect.h, origin, factor);
  return { x: rect.x, y: Math.min(y0, y1), w: rect.w, h: Math.abs(y1 - y0) };
}

export interface SurfaceFrame {
  axis: "x" | "y";
  origin: number;
  toSurface: number;
  toPlan: number;
  slope_percent: number;
  simplified: boolean;
}

export function surfaceFrame(area: RoofArea, reference: Pt[]): SurfaceFrame {
  const plane = roofPlaneOf(area);
  const axis = fallAxis(plane.fall_direction_deg);
  const factor = surfaceFactor(plane.slope_percent);
  return {
    axis,
    origin: axisOrigin(reference, axis),
    toSurface: factor,
    toPlan: factor > 1e-9 ? 1 / factor : 1,
    slope_percent: plane.slope_percent,
    simplified: plane.projection_mode !== "homography",
  };
}

export const MATERIAL_SLOPE_HINT: Record<string, number> = {
  fibrocimento: 10,
  ceramica: 30,
  concreto: 30,
};
