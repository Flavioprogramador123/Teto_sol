import { DEFAULT_ETIQUETA, type Etiqueta, type ModuleSpec, type PlacedModule, type ProjectState } from "../types";
import { loadHtmlImage } from "./imageEdit";
import { CARDINAIS_8_ABBREV, cardinalDirectionPt, cardinalIndex } from "./scale";
import { DEFAULT_STAMP_LAYOUT, hydrateStampLayout, stampOverlayBoxPx } from "./stampLayout";
import painelSrc from "../../img/modulo.png";
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

function drawMetricIcon(
  ctx: CanvasRenderingContext2D,
  kind: "panel" | "bolt" | "grid",
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.2, size * 0.09);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const s = size;

  if (kind === "panel") {
    // Dois painéis inclinados com grade
    const drawPanel = (ox: number, oy: number) => {
      ctx.beginPath();
      ctx.moveTo(ox - s * 0.28, oy + s * 0.18);
      ctx.lineTo(ox - s * 0.05, oy - s * 0.28);
      ctx.lineTo(ox + s * 0.32, oy - s * 0.12);
      ctx.lineTo(ox + s * 0.1, oy + s * 0.34);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox - s * 0.16, oy - s * 0.05);
      ctx.lineTo(ox + s * 0.12, oy + s * 0.12);
      ctx.moveTo(ox - s * 0.02, oy - s * 0.2);
      ctx.lineTo(ox + s * 0.2, oy - s * 0.02);
      ctx.stroke();
    };
    drawPanel(-s * 0.12, 0);
    drawPanel(s * 0.1, -s * 0.06);
  } else if (kind === "bolt") {
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -s * 0.42);
    ctx.lineTo(-s * 0.12, s * 0.02);
    ctx.lineTo(s * 0.02, s * 0.02);
    ctx.lineTo(-s * 0.05, s * 0.42);
    ctx.lineTo(s * 0.18, -s * 0.08);
    ctx.lineTo(s * 0.02, -s * 0.08);
    ctx.closePath();
    ctx.fill();
  } else {
    // Grade / quantidade
    const r = s * 0.36;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    const q = s * 0.16;
    ctx.fillRect(-r + s * 0.08, r - q - s * 0.08, q, q);
    ctx.fillRect(r - q - s * 0.08, -r + s * 0.08, q, q);
  }
  ctx.restore();
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

  const cols: { icon: "panel" | "bolt" | "grid"; label: string; value: string }[] = [
    { icon: "panel", label: "Potência por módulo", value: `${module.power_w} W` },
    {
      icon: "bolt",
      label: "Potência total",
      value: `${powerKwp.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp`,
    },
    { icon: "grid", label: "Quantidade", value: `${installed} módulos` },
  ];
  const colW = (w - pad * 2) / 3;
  const iconColor = "#7ec8ff";
  const iconSize = w * 0.055;
  cols.forEach((c, i) => {
    const cx = x + pad + colW * i;
    if (i > 0) {
      ctx.strokeStyle = "rgba(90, 160, 200, 0.45)";
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.58);
      ctx.lineTo(cx, y + h * 0.92);
      ctx.stroke();
    }
    const textX = cx + colW * 0.08;
    drawMetricIcon(ctx, c.icon, textX + iconSize * 0.55, y + h * 0.655, iconSize, iconColor);
    drawText(ctx, c.label, textX + iconSize * 1.45, y + h * 0.69, w * 0.022, "#9ec4dc", "500");
    drawText(ctx, c.value, textX, y + h * 0.88, w * 0.038, "#fff", "800");
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
  const pad = w * 0.028;
  const slogan = (etiqueta.slogan || DEFAULT_ETIQUETA.slogan).trim();
  const whiteBg = Boolean(etiqueta.logo_white_bg);

  ctx.save();
  ctx.fillStyle = "rgba(8, 16, 28, 0.92)";
  ctx.strokeStyle = "#4aa3d8";
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  roundRect(ctx, x, y, w, h, Math.max(8, w * 0.04));
  ctx.fill();
  ctx.stroke();

  // Esquerda: mede o bloco da marca para posicionar a divisa depois do texto
  let leftEnd = x + w * 0.42;
  const nameColor = whiteBg ? "#0a121c" : "#ffffff";
  const subColor = whiteBg ? "#3a5a72" : "#9ec4dc";

  try {
    if (etiqueta.logo_src) {
      const brand = await loadHtmlImage(etiqueta.logo_src);
      const maxW = w * 0.4;
      const maxH = h * 0.78;
      const ratio = brand.naturalWidth / Math.max(1, brand.naturalHeight);
      let bw = maxW;
      let bh = bw / ratio;
      if (bh > maxH) {
        bh = maxH;
        bw = bh * ratio;
      }
      const lx = x + pad;
      const ly = y + (h - bh) / 2;
      if (whiteBg) {
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, lx - 2, ly - 2, bw + 4, bh + 4, 4);
        ctx.fill();
      }
      ctx.drawImage(brand, lx, ly, bw, bh);
      leftEnd = lx + bw + pad;
    } else {
      const mark = await loadHtmlImage(markSrc);
      const logoBox = h * 0.72;
      const lx = x + pad;
      const ly = y + (h - logoBox) / 2;
      const name = (etiqueta.empresa || "PIENG").split(" ")[0];
      const rest = (etiqueta.empresa || "").replace(name, "").trim() || "SOLUÇÕES ENERGÉTICAS";
      const nameSize = w * 0.058;
      const restSize = w * 0.022;
      ctx.font = `800 ${nameSize}px "DM Sans", "Segoe UI", sans-serif`;
      const nameW = ctx.measureText(name).width;
      ctx.font = `600 ${restSize}px "DM Sans", "Segoe UI", sans-serif`;
      const restW = ctx.measureText(rest).width;
      const textW = Math.max(nameW, restW);
      const textX = lx + logoBox + w * 0.018;
      const blockW = logoBox + w * 0.018 + textW;
      if (whiteBg) {
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, lx - 3, y + h * 0.1, blockW + 8, h * 0.8, 6);
        ctx.fill();
      }
      ctx.drawImage(mark, lx, ly, logoBox, logoBox);
      drawText(ctx, name, textX, y + h * 0.42, nameSize, nameColor, "800");
      drawText(ctx, rest, textX, y + h * 0.62, restSize, subColor, "600");
      leftEnd = textX + textW + pad;
    }
  } catch {
    drawText(ctx, etiqueta.empresa || "PIENG", x + pad, y + h * 0.55, w * 0.05, "#ffffff", "800");
    leftEnd = x + w * 0.4;
  }

  // Divisa depois do bloco da marca (não corta «ENERGÉTICAS»)
  const mid = Math.min(x + w * 0.72, Math.max(x + w * 0.48, leftEnd));
  ctx.strokeStyle = "rgba(220, 235, 255, 0.55)";
  ctx.lineWidth = Math.max(1, w * 0.003);
  ctx.beginPath();
  ctx.moveTo(mid, y + h * 0.18);
  ctx.lineTo(mid, y + h * 0.82);
  ctx.stroke();

  // Direita: slogan / nome do cliente
  const textX = mid + pad;
  const textMaxW = Math.max(8, x + w - pad - textX);
  const fontSize = Math.max(10, Math.min(w * 0.032, textMaxW * 0.09));
  ctx.font = `600 ${fontSize}px "DM Sans", "Segoe UI", sans-serif`;
  const words = slogan.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= textMaxW) line = trial;
    else {
      if (line) lines.push(line);
      line = word;
      if (lines.length >= 2) break;
    }
  }
  if (line && lines.length < 3) lines.push(line);
  const lineH = fontSize * 1.25;
  const blockH = lines.length * lineH;
  let ty = y + (h - blockH) / 2 + fontSize * 0.85;
  for (const ln of lines) {
    drawText(ctx, ln, textX, ty, fontSize, "#ffffff", "600");
    ty += lineH;
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

/** Bússola do imóvel (view bússola) — cardeais + seta do rumo, igual à tela. */
function drawSiteCompass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  azimuthDeg: number,
  pixelsPerMeter: number,
  opts?: { cx?: number; cy?: number; s?: number },
) {
  const s = opts?.s ?? Math.max(88, width * 0.072);
  const cx = opts?.cx ?? width - s * 1.05;
  const cy = opts?.cy ?? height - s * 1.85;
  const rOuter = s * 0.42;
  const rInner = s * 0.31;
  const active = cardinalIndex(azimuthDeg);
  const label = cardinalDirectionPt(azimuthDeg);
  const desvio = azimuthDeg - 90;

  ctx.save();
  ctx.fillStyle = "rgba(12, 16, 22, 0.9)";
  ctx.strokeStyle = "#7ec8ff";
  ctx.lineWidth = Math.max(1.5, s * 0.018);
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#3a5a72";
  ctx.lineWidth = Math.max(1, s * 0.01);
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 8; i++) {
    const deg = i * 45;
    const rad = (deg * Math.PI) / 180;
    const major = i % 2 === 0;
    const isActive = i === active;
    const rTickIn = major ? rInner : rInner * 1.05;
    const rTickOut = major ? rOuter * 0.94 : rOuter * 0.88;
    const rLabel = rOuter * 1.08;
    ctx.strokeStyle = isActive ? "#f0c14b" : major ? "#9db4c8" : "#5a7084";
    ctx.lineWidth = isActive ? Math.max(2, s * 0.025) : major ? Math.max(1.4, s * 0.016) : Math.max(1, s * 0.01);
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(rad) * rTickIn, cy - Math.cos(rad) * rTickIn);
    ctx.lineTo(cx + Math.sin(rad) * rTickOut, cy - Math.cos(rad) * rTickOut);
    ctx.stroke();
    drawText(
      ctx,
      CARDINAIS_8_ABBREV[i],
      cx + Math.sin(rad) * rLabel,
      cy - Math.cos(rad) * rLabel + (major ? s * 0.04 : s * 0.028),
      isActive ? s * 0.11 : major ? s * 0.095 : s * 0.07,
      isActive ? "#f0c14b" : major ? "#e8f0f8" : "#8aa0b4",
      isActive ? "800" : "700",
      "center",
    );
  }

  // Seta do rumo (0° = norte / cima na figura)
  const rot = ((azimuthDeg - 90) * Math.PI) / 180;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.strokeStyle = "#7ec8ff";
  ctx.fillStyle = "#7ec8ff";
  ctx.lineWidth = Math.max(2.5, s * 0.03);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-rInner * 0.85, 0);
  ctx.lineTo(rInner * 0.72, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rInner * 0.95, 0);
  ctx.lineTo(rInner * 0.55, -rInner * 0.18);
  ctx.lineTo(rInner * 0.55, rInner * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2.5, s * 0.035), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0a121c";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Legenda sob a rosa
  const chipW = s * 1.55;
  const chipH = s * 0.28;
  const chipX = cx - chipW / 2;
  const chipY = cy + rOuter + s * 0.12;
  ctx.fillStyle = "rgba(12, 16, 22, 0.88)";
  ctx.strokeStyle = "#3a5a72";
  ctx.lineWidth = 1;
  roundRect(ctx, chipX, chipY, chipW, chipH, 6);
  ctx.fill();
  ctx.stroke();
  drawText(
    ctx,
    `${label} · ${azimuthDeg.toFixed(1)}° · desvio ${desvio >= 0 ? "+" : ""}${desvio.toFixed(1)}°`,
    cx,
    chipY + chipH * 0.68,
    Math.max(10, s * 0.095),
    "#7ec8ff",
    "700",
    "center",
  );

  // Escala só no canto padrão (bússola livre no carimbo = só a figura da rosa + legenda)
  if (pixelsPerMeter > 0 && opts?.cx == null && opts?.cy == null) {
    const meters = 10;
    const bar = meters * pixelsPerMeter;
    const x0 = width - Math.min(bar, width * 0.28) - s * 0.35;
    const x1 = width - s * 0.35;
    const y = height - s * 0.28;
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
  await drawWatermark(ctx, canvas.width, canvas.height);
  await drawStampOverlays(ctx, state, canvas.width, canvas.height, etiqueta, qty, power);
  const layout = hydrateStampLayout(state.stamp_layout ?? DEFAULT_STAMP_LAYOUT);
  if (!layout.compass.visible) {
    drawNorthAndScale(ctx, canvas.width, canvas.height, state.scale.pixels_per_meter);
  }
  return canvas;
}

/** Desenha card / ticket / logo / bússola nas posições do layout. */
async function drawStampOverlays(
  ctx: CanvasRenderingContext2D,
  state: ProjectState,
  width: number,
  height: number,
  etiqueta: Etiqueta,
  qty: number,
  power: number,
) {
  const layout = hydrateStampLayout(state.stamp_layout ?? DEFAULT_STAMP_LAYOUT);

  if (layout.card.visible) {
    const b = stampOverlayBoxPx("card", layout, width, height);
    drawDataCard(ctx, b.x, b.y, b.w, etiqueta, state.module, qty, power);
  }
  if (layout.ticket.visible) {
    const b = stampOverlayBoxPx("ticket", layout, width, height);
    drawLabelCard(ctx, b.x, b.y, b.w, etiqueta);
  }
  if (layout.logo.visible) {
    const b = stampOverlayBoxPx("logo", layout, width, height);
    await drawCompanyStamp(ctx, b.x, b.y, b.w, etiqueta);
  }
  // Bússola do projeto (rosa 8 cardeais) — só se «view bússola» estiver ligado
  if (
    layout.compass.visible &&
    state.visualization?.show_compass &&
    state.scale.heading
  ) {
    const b = stampOverlayBoxPx("compass", layout, width, height);
    drawSiteCompass(ctx, width, height, state.scale.heading.azimuth_deg, state.scale.pixels_per_meter, {
      cx: b.cx,
      cy: b.cy,
      s: b.s,
    });
  }
}

/** Só os carimbos (fundo transparente) — folha inteira (export interno / legado). */
export async function composeStampOverlays(state: ProjectState): Promise<HTMLCanvasElement> {
  if (!state.image) throw new Error("Importe a figura antes de visualizar o carimbo.");
  const canvas = document.createElement("canvas");
  canvas.width = state.image.width_px;
  canvas.height = state.image.height_px;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível montar a pré-visualização.");
  const etiqueta = etiquetaFilled(state.etiqueta ?? DEFAULT_ETIQUETA);
  const modules = state.layout?.best.modules ?? [];
  const qty = modules.length > 0 ? modules.length : state.module.quantity_target;
  const power = (qty * state.module.power_w) / 1000;
  await drawStampOverlays(ctx, state, canvas.width, canvas.height, etiqueta, qty, power);
  return canvas;
}

/**
 * Uma peça por carimbo (canvas local) — caixas flutuantes no passo 7:
 * a imagem acompanha o arraste sem mover o mapa.
 */
export async function composeStampPieces(
  state: ProjectState,
): Promise<Partial<Record<"card" | "ticket" | "logo" | "compass", string>>> {
  if (!state.image) throw new Error("Importe a figura antes de visualizar o carimbo.");
  const width = state.image.width_px;
  const height = state.image.height_px;
  const layout = hydrateStampLayout(state.stamp_layout ?? DEFAULT_STAMP_LAYOUT);
  const etiqueta = etiquetaFilled(state.etiqueta ?? DEFAULT_ETIQUETA);
  const modules = state.layout?.best.modules ?? [];
  const qty = modules.length > 0 ? modules.length : state.module.quantity_target;
  const power = (qty * state.module.power_w) / 1000;
  const pieces: Partial<Record<"card" | "ticket" | "logo" | "compass", string>> = {};

  const make = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Não foi possível montar a pré-visualização.");
    return { c, ctx };
  };

  if (layout.card.visible) {
    const b = stampOverlayBoxPx("card", layout, width, height);
    const { c, ctx } = make(b.w, b.h);
    drawDataCard(ctx, 0, 0, b.w, etiqueta, state.module, qty, power);
    pieces.card = c.toDataURL("image/png");
  }
  if (layout.ticket.visible) {
    const b = stampOverlayBoxPx("ticket", layout, width, height);
    const { c, ctx } = make(b.w, b.h);
    drawLabelCard(ctx, 0, 0, b.w, etiqueta);
    pieces.ticket = c.toDataURL("image/png");
  }
  if (layout.logo.visible) {
    const b = stampOverlayBoxPx("logo", layout, width, height);
    const { c, ctx } = make(b.w, b.h);
    await drawCompanyStamp(ctx, 0, 0, b.w, etiqueta);
    pieces.logo = c.toDataURL("image/png");
  }
  if (layout.compass.visible && state.visualization?.show_compass && state.scale.heading) {
    const b = stampOverlayBoxPx("compass", layout, width, height);
    const { c, ctx } = make(b.w, b.h);
    drawSiteCompass(ctx, b.w, b.h, state.scale.heading.azimuth_deg, state.scale.pixels_per_meter, {
      cx: b.cx - b.x,
      cy: b.cy - b.y,
      s: b.s,
    });
    pieces.compass = c.toDataURL("image/png");
  }
  return pieces;
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
