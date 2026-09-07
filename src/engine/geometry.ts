import type { Pt } from "../types";

const EPS = 1e-9;

export function almostEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

export function removeDuplicatePoints(poly: Pt[], eps = 1e-6): Pt[] {
  const out: Pt[] = [];
  for (const p of poly) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > eps) {
      out.push(p);
    }
  }
  if (out.length >= 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= eps) {
      out.pop();
    }
  }
  return out;
}

export function polygonArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function polygonCentroid(poly: Pt[]): Pt {
  const a = polygonArea(poly);
  if (Math.abs(a) < EPS) {
    const x = poly.reduce((s, p) => s + p[0], 0) / Math.max(poly.length, 1);
    const y = poly.reduce((s, p) => s + p[1], 0) / Math.max(poly.length, 1);
    return [x, y];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

export function boundingBox(poly: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: Pt, b: Pt, c: Pt): boolean {
  return (
    Math.min(a[0], b[0]) - EPS <= c[0] &&
    c[0] <= Math.max(a[0], b[0]) + EPS &&
    Math.min(a[1], b[1]) - EPS <= c[1] &&
    c[1] <= Math.max(a[1], b[1]) + EPS
  );
}

export function segmentsProperIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < -EPS && o3 * o4 < -EPS;
}

export function segmentsIntersectInclusive(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 * o2 < -EPS && o3 * o4 < -EPS) return true;
  if (Math.abs(o1) <= EPS && onSegment(a, b, c)) return true;
  if (Math.abs(o2) <= EPS && onSegment(a, b, d)) return true;
  if (Math.abs(o3) <= EPS && onSegment(c, d, a)) return true;
  if (Math.abs(o4) <= EPS && onSegment(c, d, b)) return true;
  return false;
}

export function pointOnSegment(p: Pt, a: Pt, b: Pt): boolean {
  return Math.abs(orient(a, b, p)) <= 1e-6 && onSegment(a, b, p);
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    if (pointOnSegment(p, poly[i], poly[(i + 1) % poly.length])) return true;
  }
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + EPS) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function edgePairs(poly: Pt[]): Array<[Pt, Pt]> {
  const edges: Array<[Pt, Pt]> = [];
  for (let i = 0; i < poly.length; i++) {
    edges.push([poly[i], poly[(i + 1) % poly.length]]);
  }
  return edges;
}

export function polygonContainsPolygon(outer: Pt[], inner: Pt[]): boolean {
  if (inner.length < 3 || outer.length < 3) return false;
  for (const p of inner) {
    if (!pointInPolygon(p, outer)) return false;
  }
  if (!pointInPolygon(polygonCentroid(inner), outer)) return false;
  for (const [a, b] of edgePairs(inner)) {
    for (const [c, d] of edgePairs(outer)) {
      if (segmentsProperIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

export function polygonsTouchOrOverlap(a: Pt[], b: Pt[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  for (const p of a) {
    if (pointInPolygon(p, b)) return true;
  }
  for (const p of b) {
    if (pointInPolygon(p, a)) return true;
  }
  for (const [p1, p2] of edgePairs(a)) {
    for (const [q1, q2] of edgePairs(b)) {
      if (segmentsIntersectInclusive(p1, p2, q1, q2)) return true;
    }
  }
  return false;
}

export function samplePolyline(a: Pt, b: Pt, step: number): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / Math.max(step, 1e-6)));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return pts;
}

export function denseInside(poly: Pt[], container: Pt[], step: number): boolean {
  for (let i = 0; i < poly.length; i++) {
    for (const p of samplePolyline(poly[i], poly[(i + 1) % poly.length], step)) {
      if (!pointInPolygon(p, container)) return false;
    }
  }
  return pointInPolygon(polygonCentroid(poly), container);
}

export function rectPolygon(x: number, y: number, w: number, h: number): Pt[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

export function modulePolygon(m: {
  x_m: number;
  y_m: number;
  width_m: number;
  height_m: number;
  rotation_deg?: number | null;
}): Pt[] {
  const rect = rectPolygon(m.x_m, m.y_m, m.width_m, m.height_m);
  const rot = m.rotation_deg ?? 0;
  if (Math.abs(rot) < 1e-9) return rect;
  const ox = m.x_m + m.width_m / 2;
  const oy = m.y_m + m.height_m / 2;
  const r = (rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return rect.map(([x, y]) => {
    const dx = x - ox;
    const dy = y - oy;
    return [ox + dx * c - dy * s, oy + dx * s + dy * c] as Pt;
  });
}

export function pointInModule(
  p: Pt,
  m: { x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg?: number | null },
): boolean {
  const rot = m.rotation_deg ?? 0;
  let x = p[0];
  let y = p[1];
  if (Math.abs(rot) > 1e-9) {
    const ox = m.x_m + m.width_m / 2;
    const oy = m.y_m + m.height_m / 2;
    const r = (-rot * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const dx = p[0] - ox;
    const dy = p[1] - oy;
    x = ox + dx * c - dy * s;
    y = oy + dx * s + dy * c;
  }
  return x >= m.x_m - EPS && x <= m.x_m + m.width_m + EPS && y >= m.y_m - EPS && y <= m.y_m + m.height_m + EPS;
}

export function polygonsOverlapWithGap(a: Pt[], b: Pt[], gap: number): boolean {
  if (gap <= 0) return polygonsTouchOrOverlap(a, b);
  // Infla um pouco menos que gap/2 para não marcar como conflito o vão exatamente permitido.
  const inflate = Math.max(0, gap / 2 - EPS * 10);
  if (inflate <= 0) return polygonsTouchOrOverlap(a, b);
  const ea = offsetPolygon(a, inflate) ?? a;
  const eb = offsetPolygon(b, inflate) ?? b;
  return polygonsTouchOrOverlap(ea, eb);
}

/**
 * Conflito de vão entre dois módulos — mesmo critério do lançamento (AABB no rumo do telhado).
 * Evita falso positivo do offset de polígono rotacionado quando o vão está no limite.
 */
export function modulesOverlapWithGap(
  a: { x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg?: number | null },
  b: { x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg?: number | null },
  gap: number,
): boolean {
  const ra = a.rotation_deg ?? 0;
  const rb = b.rotation_deg ?? 0;
  if (Math.abs(ra) < 1e-9 && Math.abs(rb) < 1e-9) {
    return rectsOverlapWithGap(
      { x: a.x_m, y: a.y_m, w: a.width_m, h: a.height_m },
      { x: b.x_m, y: b.y_m, w: b.width_m, h: b.height_m },
      gap,
    );
  }
  // Mesmo rumo: compara AABBs no referencial do azimute (como no pack).
  if (Math.abs(ra - rb) < 0.05) {
    const acx = a.x_m + a.width_m / 2;
    const acy = a.y_m + a.height_m / 2;
    const bcx = b.x_m + b.width_m / 2;
    const bcy = b.y_m + b.height_m / 2;
    const rad = (-ra * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const dx = bcx - acx;
    const dy = bcy - acy;
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    return rectsOverlapWithGap(
      { x: -a.width_m / 2, y: -a.height_m / 2, w: a.width_m, h: a.height_m },
      { x: lx - b.width_m / 2, y: ly - b.height_m / 2, w: b.width_m, h: b.height_m },
      gap,
    );
  }
  return polygonsOverlapWithGap(modulePolygon(a), modulePolygon(b), gap);
}

/** Sobreposição real de área (ignora vão e toque só de borda). */
export function modulesHardOverlap(
  a: { x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg?: number | null },
  b: { x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg?: number | null },
): boolean {
  const pa = modulePolygon(a);
  const pb = modulePolygon(b);
  const ca: Pt = [a.x_m + a.width_m / 2, a.y_m + a.height_m / 2];
  const cb: Pt = [b.x_m + b.width_m / 2, b.y_m + b.height_m / 2];
  if (pointInPolygon(ca, pb) || pointInPolygon(cb, pa)) return true;
  for (const p of interiorSamples(pa)) {
    if (pointInPolygon(p, pb)) return true;
  }
  for (const p of interiorSamples(pb)) {
    if (pointInPolygon(p, pa)) return true;
  }
  return false;
}

function interiorSamples(poly: Pt[]): Pt[] {
  if (poly.length < 3) return [];
  const c = polygonCentroid(poly);
  const out: Pt[] = [c];
  for (let i = 0; i < poly.length; i++) {
    const [x, y] = poly[i];
    out.push([(x + c[0]) * 0.5, (y + c[1]) * 0.5]);
  }
  return out;
}

/** Sobreposição real ou vão insuficiente. */
export function modulesCollide(
  a: { x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg?: number | null },
  b: { x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg?: number | null },
  gap: number,
): boolean {
  if (modulesHardOverlap(a, b)) return true;
  if (gap <= 0) return false;
  return modulesOverlapWithGap(a, b, gap);
}

/**
 * Remove só módulos com sobreposição real de área (não remove por vão).
 * Usado em limpeza pontual (calcular), nunca ao só selecionar.
 */
export function cullOverlappingModules<T extends {
  id: string;
  x_m: number;
  y_m: number;
  width_m: number;
  height_m: number;
  rotation_deg?: number | null;
}>(modules: T[]): { kept: T[]; removed: number } {
  const kept: T[] = [];
  for (const m of modules) {
    if (kept.some((o) => modulesHardOverlap(m, o))) continue;
    kept.push(m);
  }
  return { kept, removed: modules.length - kept.length };
}

function unitLeftNormal(a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

export function offsetPolygon(poly: Pt[], delta: number, miterLimit = 4): Pt[] | null {
  const clean = removeDuplicatePoints(poly);
  if (clean.length < 3) return null;
  const area = polygonArea(clean);
  if (Math.abs(area) < EPS) return null;

  const outwardSign = area > 0 ? -1 : 1;
  const n = clean.length;
  const result: Pt[] = [];

  for (let i = 0; i < n; i++) {
    const prev = clean[(i - 1 + n) % n];
    const curr = clean[i];
    const next = clean[(i + 1) % n];
    const n1: Pt = [
      unitLeftNormal(prev, curr)[0] * outwardSign,
      unitLeftNormal(prev, curr)[1] * outwardSign,
    ];
    const n2: Pt = [
      unitLeftNormal(curr, next)[0] * outwardSign,
      unitLeftNormal(curr, next)[1] * outwardSign,
    ];
    const dot = n1[0] * n2[0] + n1[1] * n2[1];
    const denom = 1 + dot;
    if (Math.abs(denom) < 1e-6) {
      result.push([curr[0] + n1[0] * delta, curr[1] + n1[1] * delta]);
      continue;
    }
    let mx = (n1[0] + n2[0]) / denom;
    let my = (n1[1] + n2[1]) / denom;
    const mlen = Math.hypot(mx, my);
    if (mlen > miterLimit) {
      const s = miterLimit / mlen;
      mx *= s;
      my *= s;
    }
    result.push([curr[0] + mx * delta, curr[1] + my * delta]);
  }

  const newArea = polygonArea(result);
  if (!Number.isFinite(newArea) || Math.abs(newArea) < 1e-8) return null;
  if (delta < 0 && Math.sign(newArea) !== Math.sign(area)) return null;
  if (delta < 0 && !pointInPolygon(polygonCentroid(result), clean)) return null;
  return result;
}

export function rectsOverlapWithGap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap: number,
): boolean {
  return !(
    a.x + a.w + gap <= b.x + EPS ||
    b.x + b.w + gap <= a.x + EPS ||
    a.y + a.h + gap <= b.y + EPS ||
    b.y + b.h + gap <= a.y + EPS
  );
}

export function overlapsAnyModule(
  candidate: { x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg?: number | null; id?: string },
  others: Array<{ id?: string; x_m: number; y_m: number; width_m: number; height_m: number; rotation_deg?: number | null }>,
  gap: number,
): boolean {
  return others.some((o) => {
    if (candidate.id && o.id && candidate.id === o.id) return false;
    return modulesCollide(candidate, o, gap);
  });
}

export function groupOverlapsOthers(
  moving: Array<{ id: string; x_m: number; y_m: number; width_m: number; height_m: number }>,
  others: Array<{ id?: string; x_m: number; y_m: number; width_m: number; height_m: number }>,
  gap: number,
): boolean {
  return moving.some((m) => overlapsAnyModule(m, others, gap));
}
