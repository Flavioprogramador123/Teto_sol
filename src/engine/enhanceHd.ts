import type { ImageInfo } from "../types";
import { loadHtmlImage } from "./imageEdit";

/** Faixa da melhoria de imagem para calibração / apresentação leve. */
export const ENHANCE_LONG_MIN = 512;
export const ENHANCE_LONG_MAX = 768;

/** Normaliza o lado maior para [512, 768], mantendo a proporção. */
export function normalizeEnhanceSize(width: number, height: number): { width: number; height: number; factor: number } {
  const longSide = Math.max(width, height);
  let factor = 1;
  if (longSide < ENHANCE_LONG_MIN) factor = ENHANCE_LONG_MIN / longSide;
  else if (longSide > ENHANCE_LONG_MAX) factor = ENHANCE_LONG_MAX / longSide;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
    factor,
  };
}

export async function enhanceHdCanvas(source: ImageInfo): Promise<ImageInfo> {
  const img = await loadHtmlImage(source.src);
  const { width, height } = normalizeEnhanceSize(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível para melhorar a imagem.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "contrast(1.16) saturate(1.1) brightness(1.05)";
  ctx.drawImage(img, 0, 0, width, height);
  const src = canvas.toDataURL("image/png");
  const base = source.file.replace(/(-edit|-hd)?\.[^.]+$/, "");
  return {
    ...source,
    file: `${base}-hd.png`,
    width_px: width,
    height_px: height,
    src,
    hd_applied: true,
  };
}
