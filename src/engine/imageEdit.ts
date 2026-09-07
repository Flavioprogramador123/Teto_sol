import type { ImageInfo, Pt, RectPx } from "../types";
import { uid } from "../lib/id";

export function normalizeRect(x0: number, y0: number, x1: number, y1: number): Omit<RectPx, "id"> {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

export function clampRect(rect: Omit<RectPx, "id">, width: number, height: number, min = 24): Omit<RectPx, "id"> {
  let { x, y, w, h } = rect;
  w = Math.max(min, Math.min(w, width));
  h = Math.max(min, Math.min(h, height));
  x = Math.min(Math.max(0, x), Math.max(0, width - w));
  y = Math.min(Math.max(0, y), Math.max(0, height - h));
  return { x, y, w, h };
}

export function pointInRect(p: Pt, r: Omit<RectPx, "id">): boolean {
  return p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h;
}

export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move";

export function hitCropHandle(p: Pt, r: Omit<RectPx, "id">, tol: number): CropHandle | null {
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  const near = (x: number, y: number) => Math.hypot(p[0] - x, p[1] - y) <= tol;
  if (near(r.x, r.y)) return "nw";
  if (near(x1, r.y)) return "ne";
  if (near(r.x, y1)) return "sw";
  if (near(x1, y1)) return "se";
  if (near((r.x + x1) / 2, r.y)) return "n";
  if (near((r.x + x1) / 2, y1)) return "s";
  if (near(r.x, (r.y + y1) / 2)) return "w";
  if (near(x1, (r.y + y1) / 2)) return "e";
  if (pointInRect(p, r)) return "move";
  return null;
}

export function resizeRect(
  start: Omit<RectPx, "id">,
  handle: CropHandle,
  from: Pt,
  to: Pt,
  bounds: { w: number; h: number },
): Omit<RectPx, "id"> {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  let { x, y, w, h } = start;
  if (handle === "move") {
    return clampRect({ x: x + dx, y: y + dy, w, h }, bounds.w, bounds.h);
  }
  if (handle.includes("w")) {
    const next = Math.min(x + w - 24, x + dx);
    w += x - next;
    x = next;
  }
  if (handle.includes("e")) w += dx;
  if (handle.includes("n")) {
    const next = Math.min(y + h - 24, y + dy);
    h += y - next;
    y = next;
  }
  if (handle.includes("s")) h += dy;
  return clampRect({ x, y, w, h }, bounds.w, bounds.h);
}

export function suggestMapCrop(width: number, height: number): Omit<RectPx, "id"> {
  return clampRect(
    {
      x: Math.round(width * 0.012),
      y: Math.round(height * 0.086),
      w: Math.round(width * 0.86),
      h: Math.round(height * 0.80),
    },
    width,
    height,
  );
}

export function suggestChromeRedacts(width: number, height: number): RectPx[] {
  const top = Math.round(height * 0.086);
  const bottom = Math.round(height * 0.095);
  const right = Math.round(width * 0.12);
  return [
    { id: uid("hide"), x: 0, y: 0, w: width, h: top },
    { id: uid("hide"), x: 0, y: height - bottom, w: width, h: bottom },
    { id: uid("hide"), x: width - right, y: top, w: right, h: height - top - bottom },
  ];
}

export function shiftPoint(p: Pt, dx: number, dy: number): Pt {
  return [p[0] + dx, p[1] + dy];
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    img.src = src;
  });
}

export async function composeEditedImage(
  source: ImageInfo,
  crop: Omit<RectPx, "id"> | null,
  redacts: RectPx[],
): Promise<ImageInfo> {
  const img = await loadHtmlImage(source.src);
  const area = crop
    ? clampRect(crop, source.width_px, source.height_px)
    : { x: 0, y: 0, w: source.width_px, h: source.height_px };
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.w));
  canvas.height = Math.max(1, Math.round(area.h));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível para recortar a imagem.");
  ctx.drawImage(img, area.x, area.y, area.w, area.h, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b0e12";
  for (const r of redacts) {
    ctx.fillRect(r.x - area.x, r.y - area.y, r.w, r.h);
  }
  const src = canvas.toDataURL("image/png");
  const base = source.file.replace(/(-edit)?\.[^.]+$/, "");
  return {
    file: `${base}-edit.png`,
    width_px: canvas.width,
    height_px: canvas.height,
    src,
    original_src: source.original_src,
    original_width_px: source.original_width_px,
    original_height_px: source.original_height_px,
    offset_px: [source.offset_px[0] + area.x, source.offset_px[1] + area.y],
    hd_applied: false,
  };
}

export function handlePoints(r: Omit<RectPx, "id">): Array<{ id: CropHandle; p: Pt }> {
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  const mx = (r.x + x1) / 2;
  const my = (r.y + y1) / 2;
  return [
    { id: "nw", p: [r.x, r.y] },
    { id: "n", p: [mx, r.y] },
    { id: "ne", p: [x1, r.y] },
    { id: "e", p: [x1, my] },
    { id: "se", p: [x1, y1] },
    { id: "s", p: [mx, y1] },
    { id: "sw", p: [r.x, y1] },
    { id: "w", p: [r.x, my] },
  ];
}
