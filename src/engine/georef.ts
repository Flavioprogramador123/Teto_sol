import type { GeoRef } from "../types";
import { EMPTY_GEOREF } from "../types";

/**
 * Google Earth Web pode exibir coordenadas em três formatos:
 *   DM  — graus + minutos decimais:  16°19.4580'S 48°55.5277'W
 *   DMS — graus + minutos + segundos: 16°19'27.48"S 48°55'31.66"W
 *   DD  — graus decimais:            -16.324300, -48.925462
 * Layout do rodapé (esq → dir): escala → Câmera → coords → elevação.
 */

export type CoordFormat = "dm" | "dms" | "dd" | "unknown";

const COORD_DMS_RE =
  /(\d{1,3})\s*[°º]?\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*["″]?\s*([NSns])\s+(\d{1,3})\s*[°º]?\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*["″]?\s*([EWOLeolo])/u;

/** Minutos com parte decimal → DM (não confundir com DMS). */
const COORD_DM_RE =
  /(\d{1,3})\s*[°ºoO]?\s*(\d{1,2}[.,]\d+)\s*['′’]?\s*([NSns])\s+(\d{1,3})\s*[°ºoO]?\s*(\d{1,2}[.,]\d+)\s*['′’]?\s*([EWOLeolo])/u;

/** Minutos inteiros sem segundos (raro no Earth, mas aparece no OCR). */
const COORD_DM_INT_RE =
  /(\d{1,3})\s*[°º]?\s*(\d{1,2})\s*['′’]\s*([NSns])\s+(\d{1,3})\s*[°º]?\s*(\d{1,2})\s*['′’]\s*([EWOLeolo])/u;

/** OCR fraco: espaço no lugar do grau, hemisfério separado. */
const COORD_DM_LOOSE_RE =
  /(\d{1,2})\s*[°ºoO?\s]\s*(\d{1,2}[.,]\d{2,6})\s*['′’`]?\s*([NSns])\s+(\d{1,3})\s*[°ºoO?\s]\s*(\d{1,2}[.,]\d{2,6})\s*['′’`]?\s*([EWOLeolo])/u;

const COORD_DD_RE =
  /([+-]?\d{1,2}[.,]\d{3,8})\s*[,;\s]\s*([+-]?\d{1,3}[.,]\d{3,8})/;

const CAMERA_RE =
  /(?:c[aâáàãä]?mera|camera|cam)\s*[.:]?\s*([\d]{1,2}[.,]\d{3}|\d{3,5}(?:[.,]\d+)?)\s*m/i;
const DATE_RE = /(\d{1,2}\/\d{1,2}\/\d{4})/;
const METER_RE = /(?<![\d.,])(\d{1,3}(?:[.,]\d+)?)\s*m\b/gi;

function toNumber(raw: string): number {
  return Number(raw.replace(",", "."));
}

function hemiSign(hemi: string): number {
  const h = hemi.toUpperCase();
  return h === "S" || h === "W" || h === "O" ? -1 : 1;
}

function dmToDeg(deg: number, minutes: number, hemi: string): number {
  return hemiSign(hemi) * (deg + minutes / 60);
}

function dmsToDeg(deg: number, minutes: number, seconds: number, hemi: string): number {
  return hemiSign(hemi) * (deg + minutes / 60 + seconds / 3600);
}

/** Normaliza ruído típico do OCR no rodapé fixo. */
export function normalizeOcrText(text: string): string {
  let raw = text.replace(/[\n\t]+/g, " ");
  raw = raw.replace(/(\d)\s*[?:]\s*(\d)/g, "$1°$2");
  raw = raw.replace(/(\d)\s+[oO]\s+(\d)/g, "$1°$2");
  raw = raw.replace(/[′’`ʹ]/g, "'");
  raw = raw.replace(/[″""]/g, '"');
  raw = raw.replace(/(\d)\s*"\s*([NSns])\b/g, '$1"$2');
  raw = raw.replace(/(\d)\s*"\s*([EWOLeolo])\b/g, '$1"$2');
  raw = raw.replace(/\b(\d{1,3})'\s*(\d{1,2}[.,]\d{2,6})\s*'\s*([EWOLeolo])\b/g, "$1°$2'$3");
  raw = raw.replace(/\b(\d{1,3})'\s*(\d{1,2}[.,]\d{2,6})\s+([EWOLeolo])\b/g, "$1°$2'$3");
  raw = raw.replace(/\b(\d{1,2})'\s*(\d{1,2}[.,]\d{2,6})\s*'\s*([NSns])\b/g, "$1°$2'$3");
  raw = raw.replace(/\b(\d{1,2})'\s*(\d{1,2}[.,]\d{2,6})\s+([NSns])\b/g, "$1°$2'$3");
  raw = raw.replace(/(\d{1,2})\s*'\s*(\d{1,2}(?:[.,]\d+)?)\s*"\s*([NSns])\b/g, '$1\'$2"$3');
  raw = raw.replace(/(\d{1,2})\s*'\s*(\d{1,2}(?:[.,]\d+)?)\s*"\s*([EWOLeolo])\b/g, '$1\'$2"$3');
  // 16°19.4580' S → grudar hemisfério
  raw = raw.replace(/(\d)\s*'\s*([NSns])\b/g, "$1'$2");
  raw = raw.replace(/(\d)\s*'\s*([EWOLeolo])\b/g, "$1'$2");
  raw = raw.replace(/(\d[.,]\d+)\s*'\s*([NSns])\b/g, "$1'$2");
  raw = raw.replace(/(\d[.,]\d+)\s*'\s*([EWOLeolo])\b/g, "$1'$2");
  raw = raw.replace(/'\s*(?:VV|W)\b/gi, "'W");
  raw = raw.replace(/c[aâáàãä]?mera/gi, "Câmera");
  return raw.replace(/\s+/g, " ").trim();
}

/** Google Earth PT-BR usa 1.074 m para 1074 m (ponto de milhar). */
export function parseEarthMeters(raw: string, kind: "camera" | "elevation" | "scale"): number {
  const n = toNumber(raw);
  if (!Number.isFinite(n)) return NaN;
  if (kind === "scale") return n;
  if (/^\d{1,2}[.,]\d{3}$/.test(raw.trim()) && n > 0 && n < 20) return Math.round(n * 1000);
  return n;
}

function applyMeters(next: GeoRef, raw: string) {
  const cam = raw.match(CAMERA_RE);
  if (cam) next.camera_m = parseEarthMeters(cam[1], "camera");

  const date = raw.match(DATE_RE);
  if (date) next.imagery_date = date[1];

  const meterTokens = [...raw.matchAll(METER_RE)].map((match) => match[1]);
  const thousandStyle = meterTokens.filter((token) => /^\d{1,2}[.,]\d{3}$/.test(token.trim()));

  // Se o OCR não leu "Câmera:", use a ordem do rodapé: 1º milhar = câmera, último = solo.
  if (next.camera_m == null && thousandStyle.length >= 1) {
    next.camera_m = parseEarthMeters(thousandStyle[0], "camera");
  }

  const scaleValues = meterTokens
    .filter((token) => !/^\d{1,2}[.,]\d{3}$/.test(token.trim()))
    .map((token) => parseEarthMeters(token, "scale"))
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 200 && m !== next.camera_m);
  if (scaleValues.length) next.scale_bar_m = scaleValues[0];

  if (thousandStyle.length >= 2) {
    next.elevation_m = parseEarthMeters(thousandStyle[thousandStyle.length - 1], "elevation");
  } else {
    const elevValues = meterTokens
      .map((token) => parseEarthMeters(token, "elevation"))
      .filter((m) => Number.isFinite(m) && m >= 50 && m !== next.camera_m && m !== next.scale_bar_m);
    if (elevValues.length) next.elevation_m = elevValues[elevValues.length - 1];
  }
}

export function detectCoordFormat(text: string): CoordFormat {
  const raw = normalizeOcrText(text);
  if (COORD_DMS_RE.test(raw)) return "dms";
  if (COORD_DM_RE.test(raw) || COORD_DM_INT_RE.test(raw) || COORD_DM_LOOSE_RE.test(raw)) return "dm";
  if (COORD_DD_RE.test(raw)) return "dd";
  return "unknown";
}

/** Aceita decimal (−16.32), DM (16°19.4580'S) ou DMS (16°19'27"S) em um único campo. */
export function parseCoordInput(text: string, axis: "lat" | "lon"): number | null {
  const raw = normalizeOcrText(text.trim());
  if (!raw) return null;

  const dd = raw.match(/^([+-]?\d{1,3}(?:[.,]\d+)?)\s*°?$/);
  if (dd) {
    const v = toNumber(dd[1]);
    if (axis === "lat" && Math.abs(v) <= 90) return v;
    if (axis === "lon" && Math.abs(v) <= 180) return v;
    return null;
  }

  const dms = raw.match(/^(\d{1,3})\s*[°º]?\s*(\d{1,2})\s*['′’]\s*(\d{1,2}(?:[.,]\d+)?)\s*["″]?\s*([NSnsEWOLeolo])$/u);
  if (dms) {
    const hemi = dms[4];
    if (axis === "lat" && !/^[NSns]$/.test(hemi)) return null;
    if (axis === "lon" && !/^[EWOLeolo]$/.test(hemi)) return null;
    return dmsToDeg(Number(dms[1]), Number(dms[2]), toNumber(dms[3]), hemi);
  }

  const dm = raw.match(/^(\d{1,3})\s*[°ºoO]?\s*(\d{1,2}(?:[.,]\d+)?)\s*['′’]?\s*([NSnsEWOLeolo])$/u);
  if (dm) {
    const hemi = dm[3];
    if (axis === "lat" && !/^[NSns]$/.test(hemi)) return null;
    if (axis === "lon" && !/^[EWOLeolo]$/.test(hemi)) return null;
    return dmToDeg(Number(dm[1]), toNumber(dm[2]), hemi);
  }

  return null;
}

export function formatDm(lat: number, lon: number): { lat_text: string; lon_text: string } {
  const fmt = (v: number, pos: string, neg: string) => {
    const hemi = v >= 0 ? pos : neg;
    const abs = Math.abs(v);
    const deg = Math.floor(abs);
    const minutes = (abs - deg) * 60;
    return `${deg}°${minutes.toFixed(4)}'${hemi}`;
  };
  return { lat_text: fmt(lat, "N", "S"), lon_text: fmt(lon, "E", "W") };
}

export function parseGeorefText(text: string): GeoRef {
  const raw = normalizeOcrText(text);
  const next: GeoRef = {
    ...EMPTY_GEOREF,
    raw_text: raw,
    north_up: true,
    heading_deg: 0,
    source: "google_earth_web",
  };

  const dms = raw.match(COORD_DMS_RE);
  const dm = raw.match(COORD_DM_RE) || raw.match(COORD_DM_LOOSE_RE) || raw.match(COORD_DM_INT_RE);
  const dd = raw.match(COORD_DD_RE);

  if (dms) {
    next.latitude_deg = dmsToDeg(Number(dms[1]), Number(dms[2]), toNumber(dms[3]), dms[4]);
    next.longitude_deg = dmsToDeg(Number(dms[5]), Number(dms[6]), toNumber(dms[7]), dms[8]);
    next.lat_text = `${dms[1]}°${dms[2]}'${dms[3]}"${dms[4].toUpperCase()}`;
    next.lon_text = `${dms[5]}°${dms[6]}'${dms[7]}"${dms[8].toUpperCase()}`;
  } else if (dm) {
    next.latitude_deg = dmToDeg(Number(dm[1]), toNumber(dm[2]), dm[3]);
    next.longitude_deg = dmToDeg(Number(dm[4]), toNumber(dm[5]), dm[6]);
    next.lat_text = `${dm[1]}°${dm[2]}'${dm[3].toUpperCase()}`;
    next.lon_text = `${dm[4]}°${dm[5]}'${dm[6].toUpperCase()}`;
  } else if (dd) {
    const lat = toNumber(dd[1]);
    const lon = toNumber(dd[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      next.latitude_deg = lat;
      next.longitude_deg = lon;
      const dmTxt = formatDm(lat, lon);
      next.lat_text = dmTxt.lat_text;
      next.lon_text = dmTxt.lon_text;
    }
  }

  applyMeters(next, raw);

  if (next.latitude_deg != null && next.longitude_deg != null) next.confidence = "high";
  else if (next.scale_bar_m != null || next.camera_m != null) next.confidence = "low";
  else next.confidence = raw ? "low" : "none";

  return next;
}

export function formatGeoRef(g: GeoRef): string {
  const parts: string[] = ["Google Earth · norte para cima"];
  if (g.lat_text && g.lon_text) parts.push(`${g.lat_text} ${g.lon_text}`);
  else if (g.latitude_deg != null && g.longitude_deg != null) {
    parts.push(`${g.latitude_deg.toFixed(6)}°, ${g.longitude_deg.toFixed(6)}°`);
  }
  if (g.scale_bar_m != null) parts.push(`barra ${g.scale_bar_m} m`);
  if (g.elevation_m != null) parts.push(`solo ${g.elevation_m} m`);
  if (g.camera_m != null) parts.push(`câmera ${g.camera_m} m`);
  if (g.imagery_date) parts.push(g.imagery_date);
  if (g.cidade || g.endereco) parts.push([g.endereco, g.bairro, g.cidade].filter(Boolean).join(", "));
  return parts.join(" · ");
}
