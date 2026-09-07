import { DEFAULT_ETIQUETA, type Etiqueta, type ModuleSpec, type PlacedModule, type ProjectState } from "../types";
import { loadHtmlImage } from "./imageEdit";
import painelSrc from "../../img/modulo.png";
import brandSrc from "../../img/brand/logo-stamp.png";
import watermarkSrc from "../../img/brand/logo-watermark.png";
import markSrc from "../../img/brand/logo-mark.png";

export function todayPtBr(): string {
  return new Date().toLocaleDateString("pt-BR");
}

export function etiquetaFilled(e: Etiqueta): Etiqueta {
  return {
    ...DEFAULT_ETIQUETA,
    ...e,
    bairro: e.bairro ?? "",
    data: e.data || todayPtBr(),
  };
}

function backgroundSrc(state: ProjectState): string | null {
  if (!state.image) return null;
  if (state.visualization?.use_enhanced && state.visualization.enhanced_src) {
    return state.visualization.enhanced_src;
  }
  return state.image.src;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = "600",
  align: CanvasTextAlign = "left",
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "DM Sans", "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

function drawDataCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  etiqueta: Etiqueta,
  module: ModuleSpec,
  installed: number,
  powerKwp: number,
) {
  const h = w * 0.36;
  ctx.save();
  ctx.fillStyle = "rgba(8, 16, 28, 0.88)";
  ctx.strokeStyle = "#4aa3d8";
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();

  const pad = w * 0.045;
  drawText(ctx, etiqueta.titulo || "PROJEÇÃO DE IMPLANTAÇÃO", x + pad, y + h * 0.28, w * 0.048, "#fff", "800");
  const modelBit = [module.brand, module.model].filter(Boolean).join(" ");
  const sub = `${installed} MÓDULOS ${modelBit} · ${module.power_w} W`.replace(/\s+/g, " ").trim();
  drawText(ctx, sub, x + pad, y + h * 0.46, w * 0.032, "#e8f2ff", "600");

  ctx.strokeStyle = "#3d8ec4";
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.beginPath();
  ctx.moveTo(x + pad, y + h * 0.54);
  ctx.lineTo(x + w * 0.28, y + h * 0.54);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, y + h * 0.54);
  ctx.lineTo(x + w - pad, y + h * 0.54);
  ctx.stroke();

  const cols = [
    { label: "Potência por módulo", value: `${module.power_w} W` },
    { label: "Potência total", value: `${powerKwp.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp` },
    { label: "Quantidade", value: `${installed} módulos` },
  ];
  const colW = (w - pad * 2) / 3;
  cols.forEach((c, i) => {
    const cx = x + pad + colW * i;
    if (i > 0) {
      ctx.strokeStyle = "rgba(90, 160, 200, 0.45)";
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.62);
      ctx.lineTo(cx, y + h * 0.9);
      ctx.stroke();
    }
    drawText(ctx, c.label, cx + colW * 0.08, y + h * 0.72, w * 0.022, "#9ec4dc", "500");
    drawText(ctx, c.value, cx + colW * 0.08, y + h * 0.88, w * 0.038, "#fff", "800");
  });
  ctx.restore();
  return h;
}

function drawLabelCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  etiqueta: Etiqueta,
) {
  const lines = [
    ["Cliente", etiqueta.cliente || "—"],
    ["Endereço", etiqueta.endereco || "—"],
    ["Bairro", etiqueta.bairro || "—"],
    ["Cidade", etiqueta.cidade || "—"],
    ["Data", etiqueta.data || todayPtBr()],
    ["Responsável", etiqueta.responsavel || "—"],
  ];
  const h = w * 1.05;
  ctx.save();
  ctx.fillStyle = "rgba(8, 16, 28, 0.88)";
  ctx.strokeStyle = "#4aa3d8";
  ctx.lineWidth = Math.max(1.5, w * 0.006);
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
  drawText(ctx, "ETIQUETA DO PROJETO", x + w * 0.06, y + h * 0.1, w * 0.05, "#7ec8ff", "800");
  lines.forEach((row, i) => {
    const yy = y + h * (0.2 + i * 0.125);
    drawText(ctx, row[0], x + w * 0.06, yy, w * 0.038, "#9ec4dc", "500");
    drawText(ctx, row[1], x + w * 0.06, yy + h * 0.055, w * 0.045, "#fff", "700");
  });
  ctx.restore();
  return h;
}

async function drawCompanyStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  etiqueta: Etiqueta,
) {
  const h = w * 0.2;
  try {
    // logo-stamp.png (ou logo custom) com fundo transparente — sem caixa branca
    const brand = await loadHtmlImage(etiqueta.logo_src || brandSrc);
    const ratio = brand.naturalWidth / Math.max(1, brand.naturalHeight);
    const bh = Math.min(h, w / Math.max(ratio, 0.1));
    const bw = bh * ratio;
    ctx.drawImage(brand, x, y + (h - bh) / 2, bw, bh);
    return h;
  } catch {
    /* fallback abaixo */
  }

  ctx.save();
  ctx.fillStyle = "rgba(8, 16, 28, 0.9)";
  ctx.strokeStyle = "#4aa3d8";
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();

  try {
    const mark = await loadHtmlImage(markSrc);
    const logoBox = h * 0.72;
    const lx = x + w * 0.03;
    const ly = y + (h - logoBox) / 2;
    ctx.drawImage(mark, lx, ly, logoBox, logoBox);
    const name = (etiqueta.empresa || "PIENG").split(" ")[0];
    const rest = (etiqueta.empresa || "").replace(name, "").trim();
    drawText(ctx, name, lx + logoBox + w * 0.03, y + h * 0.42, w * 0.07, "#fff", "800");
    drawText(ctx, rest || "SOLUÇÕES ENERGÉTICAS", lx + logoBox + w * 0.03, y + h * 0.62, w * 0.028, "#d6e6f5", "600");
  } catch {
    drawText(ctx, etiqueta.empresa || "PIENG", x + w * 0.05, y + h * 0.55, w * 0.05, "#fff", "800");
  }
  ctx.restore();
  return h;
}

async function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  try {
    const wm = await loadHtmlImage(watermarkSrc);
    const maxW = width * 0.28;
    const ratio = wm.naturalWidth / Math.max(1, wm.naturalHeight);
    const bw = maxW;
    const bh = bw / ratio;
    ctx.drawImage(wm, width - bw - width * 0.03, height * 0.42 - bh / 2, bw, bh);
  } catch {
    /* sem marca d'água */
  }
}

function drawNorthAndScale(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelsPerMeter: number,
) {
  const s = Math.max(64, width * 0.055);
  const cx = width - s * 1.15;
  const cy = height - s * 2.15;
  ctx.save();
  ctx.fillStyle = "rgba(10, 14, 20, 0.72)";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e05a4f";
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.32);
  ctx.lineTo(cx + s * 0.1, cy);
  ctx.lineTo(cx, cy - s * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f4f7fb";
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.32);
  ctx.lineTo(cx - s * 0.1, cy);
  ctx.lineTo(cx, cy + s * 0.06);
  ctx.closePath();
  ctx.fill();
  drawText(ctx, "N", cx, cy + s * 0.58, s * 0.22, "#fff", "800", "center");

  if (pixelsPerMeter > 0) {
    const meters = 10;
    const bar = meters * pixelsPerMeter;
    const x0 = width - Math.min(bar, width * 0.28) - s * 0.4;
    const x1 = width - s * 0.4;
    const y = height - s * 0.55;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.moveTo(x0, y - 8);
    ctx.lineTo(x0, y + 8);
    ctx.moveTo((x0 + x1) / 2, y - 6);
    ctx.lineTo((x0 + x1) / 2, y + 6);
    ctx.moveTo(x1, y - 8);
    ctx.lineTo(x1, y + 8);
    ctx.stroke();
    drawText(ctx, "0", x0, y - 12, 14, "#fff", "700", "center");
    drawText(ctx, `${meters} m`, x1, y - 12, 14, "#fff", "700", "center");
  }
  ctx.restore();
}

async function drawModules(
  ctx: CanvasRenderingContext2D,
  modules: PlacedModule[],
  mpp: number,
  options?: { showNumbers?: boolean },
) {
  if (!modules.length || !(mpp > 0)) return;
  let painel: HTMLImageElement | null = null;
  try {
    painel = await loadHtmlImage(painelSrc);
  } catch {
    painel = null;
  }
  const showNumbers = Boolean(options?.showNumbers);
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    const x = m.x_m / mpp;
    const y = m.y_m / mpp;
    const w = m.width_m / mpp;
    const h = m.height_m / mpp;
    const rot = m.rotation_deg ?? 0;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);
    if (painel) {
      if (m.orientation === "paisagem" || w > h) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(painel, -h / 2, -w / 2, h, w);
        ctx.restore();
      } else {
        ctx.drawImage(painel, 0, 0, w, h);
      }
    } else {
      ctx.fillStyle = "#163a7a";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.strokeStyle = "rgba(26,20,8,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    if (showNumbers) {
      const n = i + 1;
      const fontSize = Math.max(10, Math.min(w, h) * 0.34);
      ctx.font = `700 ${fontSize}px "DM Sans", "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2, fontSize * 0.18);
      ctx.strokeStyle = "#1a1408";
      ctx.fillStyle = "#fff8e6";
      ctx.strokeText(String(n), w / 2, h / 2);
      ctx.fillText(String(n), w / 2, h / 2);
    }
    ctx.restore();
  }
}

export async function composeStampSheet(state: ProjectState): Promise<HTMLCanvasElement> {
  const src = backgroundSrc(state);
  if (!src) throw new Error("Importe a figura antes de gerar o arquivo.");
  const bg = await loadHtmlImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = bg.naturalWidth;
  canvas.height = bg.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível montar a figura.");
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  // Sem polígonos de área/restrita no arquivo — só módulos (+ números se o view estiver ligado).
  const mpp = state.scale.meters_per_pixel;
  const showModules = state.visualization?.show_modules !== false;
  const showNumbers = Boolean(state.visualization?.show_module_numbers);
  if (showModules) {
    await drawModules(ctx, state.layout?.best.modules ?? [], mpp, { showNumbers });
  }

  const etiqueta = etiquetaFilled(state.etiqueta ?? DEFAULT_ETIQUETA);
  // Quantidade = módulos na figura (inclui os vermelhos). «installed» exclui violações e divergia do mapa.
  const modules = state.layout?.best.modules ?? [];
  const qty = modules.length > 0 ? modules.length : state.module.quantity_target;
  const power = (qty * state.module.power_w) / 1000;
  const margin = canvas.width * 0.016;
  await drawWatermark(ctx, canvas.width, canvas.height);
  // Carimbo / etiqueta / logo — tamanho médio (legível sem cobrir o telhado)
  const dataW = canvas.width * 0.24;
  drawDataCard(ctx, margin, margin, dataW, etiqueta, state.module, qty, power);
  const labelW = canvas.width * 0.135;
  drawLabelCard(ctx, canvas.width - labelW - margin, margin, labelW, etiqueta);
  const brandW = canvas.width * 0.2;
  await drawCompanyStamp(
    ctx,
    margin,
    canvas.height - brandW * 0.22 - margin,
    brandW,
    etiqueta,
  );
  drawNorthAndScale(ctx, canvas.width, canvas.height, state.scale.pixels_per_meter);
  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG."))), "image/png");
  });
}

function jpegBytes(canvas: HTMLCanvasElement): Uint8Array {
  const data = canvas.toDataURL("image/jpeg", 0.92);
  const raw = atob(data.split(",")[1] ?? "");
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function canvasToPdfBlob(canvas: HTMLCanvasElement): Blob {
  const jpeg = jpegBytes(canvas);
  const imgW = canvas.width;
  const imgH = canvas.height;
  const pageW = 842;
  const pageH = Math.max(1, Math.round((pageW * imgH) / imgW));
  const objects: string[] = [];
  const push = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  push("<< /Type /Catalog /Pages 2 0 R >>");
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`);
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  const encoder = new TextEncoder();
  const header = "%PDF-1.4\n";
  const parts: Uint8Array[] = [encoder.encode(header)];
  const offsets = [0];
  let cursor = header.length;
  for (let i = 0; i < 4; i++) {
    const chunk = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    const bytes = encoder.encode(chunk);
    offsets.push(cursor);
    parts.push(bytes);
    cursor += bytes.length;
  }
  const imgHeader = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`;
  const imgTail = encoder.encode("\nendstream\nendobj\n");
  offsets.push(cursor);
  const headBytes = encoder.encode(imgHeader);
  parts.push(headBytes, jpeg, imgTail);
  cursor += headBytes.length + jpeg.length + imgTail.length;

  const xrefPos = cursor;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  parts.push(encoder.encode(xref), encoder.encode(trailer));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const bin = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bin.set(part, offset);
    offset += part.length;
  }
  return new Blob([bin.buffer], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
