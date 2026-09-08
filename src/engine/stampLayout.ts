import type { StampLayout, StampOverlay, StampOverlayId } from "../types";

export const STAMP_OVERLAY_IDS: StampOverlayId[] = ["card", "ticket", "logo", "compass"];

export const STAMP_OVERLAY_LABELS: Record<StampOverlayId, string> = {
  card: "Projeção",
  ticket: "Ticket",
  logo: "Logo",
  compass: "Bússola",
};

/** Posições padrão (frações da figura) — equivalentes ao carimbo fixo anterior. */
export const DEFAULT_STAMP_LAYOUT: StampLayout = {
  card: { x: 0.016, y: 0.016, scale: 1, visible: true },
  ticket: { x: 0.849, y: 0.016, scale: 1, visible: true },
  logo: { x: 0.016, y: 0.93, scale: 1, visible: true },
  compass: { x: 0.86, y: 0.72, scale: 1, visible: true },
};

export function clampStampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(2.5, Math.max(0.45, scale));
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(0.98, Math.max(0, n));
}

export function normalizeStampOverlay(raw?: Partial<StampOverlay> | null, fallback?: StampOverlay): StampOverlay {
  const base = fallback ?? { x: 0.02, y: 0.02, scale: 1, visible: true };
  return {
    x: clamp01(raw?.x ?? base.x),
    y: clamp01(raw?.y ?? base.y),
    scale: clampStampScale(raw?.scale ?? base.scale),
    visible: raw?.visible ?? base.visible,
  };
}

export function hydrateStampLayout(raw?: Partial<StampLayout> | null): StampLayout {
  return {
    card: normalizeStampOverlay(raw?.card, DEFAULT_STAMP_LAYOUT.card),
    ticket: normalizeStampOverlay(raw?.ticket, DEFAULT_STAMP_LAYOUT.ticket),
    logo: normalizeStampOverlay(raw?.logo, DEFAULT_STAMP_LAYOUT.logo),
    compass: normalizeStampOverlay(raw?.compass, DEFAULT_STAMP_LAYOUT.compass),
  };
}

export type StampBoxPx = { x: number; y: number; w: number; h: number; cx: number; cy: number; s: number };

/** Retângulo em pixels da figura para cada elemento do carimbo. */
export function stampOverlayBoxPx(
  id: StampOverlayId,
  layout: StampLayout,
  canvasW: number,
  canvasH: number,
): StampBoxPx {
  const o = layout[id];
  if (id === "card") {
    const w = canvasW * 0.24 * o.scale;
    const h = w * 0.36;
    const x = o.x * canvasW;
    const y = o.y * canvasH;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, s: w };
  }
  if (id === "ticket") {
    const w = canvasW * 0.135 * o.scale;
    const h = w * 1.05;
    const x = o.x * canvasW;
    const y = o.y * canvasH;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, s: w };
  }
  if (id === "logo") {
    const w = canvasW * 0.2 * o.scale;
    const h = w * 0.2;
    const x = o.x * canvasW;
    const y = o.y * canvasH;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, s: w };
  }
  // compass — x/y = canto superior esquerdo; caixa justa à rosa + legenda
  const s = Math.max(88, canvasW * 0.072) * o.scale;
  const topExt = s * 0.56; // labels acima do centro
  const botExt = s * 0.82; // rosa + folga + chip abaixo do centro
  const w = s * 1.62; // chip ~1.55s + margem
  const h = topExt + botExt;
  const x = o.x * canvasW;
  const y = o.y * canvasH;
  return { x, y, w, h, cx: x + w / 2, cy: y + topExt, s };
}

export function hitStampOverlay(
  p: [number, number],
  layout: StampLayout,
  canvasW: number,
  canvasH: number,
  opts?: { includeCompass?: boolean },
): StampOverlayId | null {
  const includeCompass = opts?.includeCompass !== false;
  // Topo da pilha primeiro (ticket/card sobre logo)
  const order: StampOverlayId[] = ["ticket", "card", "compass", "logo"];
  for (const id of order) {
    if (id === "compass" && !includeCompass) continue;
    const o = layout[id];
    if (!o.visible) continue;
    const b = stampOverlayBoxPx(id, layout, canvasW, canvasH);
    if (p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h) return id;
  }
  return null;
}

export function hitStampScaleHandle(
  p: [number, number],
  id: StampOverlayId,
  layout: StampLayout,
  canvasW: number,
  canvasH: number,
  tol: number,
): boolean {
  return hitStampResizeEdge(p, id, layout, canvasW, canvasH, tol) != null;
}

/** Aresta direita, inferior ou canto SE para redimensionar. */
export function hitStampResizeEdge(
  p: [number, number],
  id: StampOverlayId,
  layout: StampLayout,
  canvasW: number,
  canvasH: number,
  tol: number,
): "e" | "s" | "se" | null {
  const b = stampOverlayBoxPx(id, layout, canvasW, canvasH);
  const onE = Math.abs(p[0] - (b.x + b.w)) <= tol && p[1] >= b.y - tol && p[1] <= b.y + b.h + tol;
  const onS = Math.abs(p[1] - (b.y + b.h)) <= tol && p[0] >= b.x - tol && p[0] <= b.x + b.w + tol;
  if (onE && onS) return "se";
  if (onE) return "e";
  if (onS) return "s";
  return null;
}
