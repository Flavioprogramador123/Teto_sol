import type { Pt, ScaleInfo } from "../types";

export function distancePx(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** 0° = norte (cima na figura), horário — para o campo azimute. */
export function lineAzimuthDeg(a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.hypot(dx, dy) < 1e-6) return 0;
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

/** Mesma convenção do azimute: 0° = norte, horário. A queda da água segue o rumo da casa. */
export function lineFallDeg(a: Pt, b: Pt): number {
  return lineAzimuthDeg(a, b);
}

/** Rumo do muro/divisa: escolhe o sentido mais perto do leste para a bússola do imóvel. */
export function buildingHeadingDeg(a: Pt, b: Pt): number {
  const az = lineAzimuthDeg(a, b);
  const flipped = (az + 180) % 360;
  const distEast = (d: number) => Math.min(Math.abs(d - 90), 360 - Math.abs(d - 90));
  return distEast(flipped) < distEast(az) ? flipped : az;
}

export function computeScale(a: Pt, b: Pt, realMeters: number): ScaleInfo {
  const px = distancePx(a, b);
  if (px < 1e-6) {
    throw new Error("Os dois pontos da escala coincidem. Marque uma distância visível.");
  }
  if (!(realMeters > 0)) {
    throw new Error("Informe uma distância real maior que zero.");
  }
  const meters_per_pixel = realMeters / px;
  return {
    meters_per_pixel,
    pixels_per_meter: 1 / meters_per_pixel,
    reference: { point_a: a, point_b: b, real_distance_m: realMeters },
    heading: null,
    calibrated: true,
    verification_error_pct: null,
    check: null,
  };
}

export function computeDirectScale(pixelsPerMeter: number): ScaleInfo {
  if (!(pixelsPerMeter > 0)) {
    throw new Error("pixels/metro deve ser maior que zero.");
  }
  return {
    meters_per_pixel: 1 / pixelsPerMeter,
    pixels_per_meter: pixelsPerMeter,
    reference: null,
    heading: null,
    calibrated: true,
    verification_error_pct: null,
    check: null,
  };
}

export function offsetBar(a: Pt, b: Pt, offsetPx: number): { a: Pt; b: Pt } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * offsetPx;
  const ny = (dx / len) * offsetPx;
  return { a: [a[0] + nx, a[1] + ny], b: [b[0] + nx, b[1] + ny] };
}

export function barFrom(a: Pt, b: Pt, lengthPx: number, offsetPx: number): { a: Pt; b: Pt } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const base = offsetBar(a, b, offsetPx).a;
  return {
    a: base,
    b: [base[0] + (dx / len) * lengthPx, base[1] + (dy / len) * lengthPx],
  };
}

export function verifyCalibration(scale: ScaleInfo, checkMeters = 10, tolerancePct = 2) {
  if (!scale.reference || !scale.calibrated) {
    throw new Error("Marque a escala e informe o tamanho antes de conferir.");
  }
  const marked_px = distancePx(scale.reference.point_a, scale.reference.point_b);
  const marked_m = scale.reference.real_distance_m;
  const generated_px = checkMeters * scale.pixels_per_meter;
  const expected_px_if_same = marked_m > 0 ? marked_px * (checkMeters / marked_m) : 0;
  const errorPct = expected_px_if_same > 0 ? (Math.abs(generated_px - expected_px_if_same) / expected_px_if_same) * 100 : 100;
  return {
    check_m: checkMeters,
    marked_px,
    marked_m,
    generated_px,
    generated_m: checkMeters,
    error_pct: errorPct,
    ok: errorPct <= tolerancePct,
    same_as_mark: Math.abs(marked_m - checkMeters) < 1e-6,
  };
}

export function matchModuleSide(
  meters: number,
  width_m: number,
  height_m: number,
  tolerancePct = 3,
): { side: "largura" | "altura" | null; expected: number | null; error_pct: number; ok: boolean } {
  if (!(meters > 0) || !(width_m > 0) || !(height_m > 0)) {
    return { side: null, expected: null, error_pct: 100, ok: false };
  }
  const dw = (Math.abs(meters - width_m) / width_m) * 100;
  const dh = (Math.abs(meters - height_m) / height_m) * 100;
  if (dw <= tolerancePct && dw <= dh) return { side: "largura", expected: width_m, error_pct: dw, ok: true };
  if (dh <= tolerancePct) return { side: "altura", expected: height_m, error_pct: dh, ok: true };
  return { side: null, expected: dw <= dh ? width_m : height_m, error_pct: Math.min(dw, dh), ok: false };
}

export function verifyRuler(
  scale: ScaleInfo,
  a: Pt,
  b: Pt,
  expectedMeters: number,
  tolerancePct = 2,
): { errorPct: number; ok: boolean; measured_m: number } {
  const measured_m = distancePx(a, b) * scale.meters_per_pixel;
  const errorPct = expectedMeters > 0 ? (Math.abs(measured_m - expectedMeters) / expectedMeters) * 100 : 100;
  return { errorPct, ok: errorPct <= tolerancePct, measured_m };
}

export function pxToM(p: Pt, mpp: number): Pt {
  return [p[0] * mpp, p[1] * mpp];
}

export function mToPx(p: Pt, mpp: number): Pt {
  return [p[0] / mpp, p[1] / mpp];
}

export function polyPxToM(poly: Pt[], mpp: number): Pt[] {
  return poly.map((p) => pxToM(p, mpp));
}

export function polyMToPx(poly: Pt[], mpp: number): Pt[] {
  return poly.map((p) => mToPx(p, mpp));
}
