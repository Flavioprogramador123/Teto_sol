/**
 * Receptor da ponte Gerador PIENG → PlanoSol (produtos separados).
 * Aceita postMessage e arquivo JSON com ModuleSpec + Etiqueta.
 */
import type { Etiqueta, ModuleSpec } from "../types";
import { DEFAULT_MODULE, hydrateEtiqueta } from "../types";

export const PIENG_TETO_BRIDGE_TYPE = "PIENG_TETO_BRIDGE";

export interface PiengBridgePayload {
  version?: number;
  source?: string;
  module?: Partial<ModuleSpec>;
  etiqueta?: Partial<Etiqueta> | null;
  ref?: string | null;
}

export interface PiengBridgeMessage {
  type: string;
  version?: number;
  payload?: PiengBridgePayload;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function parsePiengBridgePayload(raw: unknown): PiengBridgePayload | null {
  if (!isRecord(raw)) return null;

  // Envelope { type, payload } ou payload direto
  let body: Record<string, unknown> = raw;
  if (raw.type === PIENG_TETO_BRIDGE_TYPE && isRecord(raw.payload)) {
    body = raw.payload;
  } else if (raw.source === "pieng-gerador" || isRecord(raw.module)) {
    body = raw;
  } else {
    return null;
  }

  if (!isRecord(body.module)) return null;
  return body as unknown as PiengBridgePayload;
}

export function moduleFromPiengBridge(mod: Partial<ModuleSpec> | undefined): ModuleSpec {
  const m = mod || {};
  return {
    brand: String(m.brand || DEFAULT_MODULE.brand),
    model: String(m.model || DEFAULT_MODULE.model),
    power_w: Math.max(1, Number(m.power_w) || DEFAULT_MODULE.power_w),
    width_m: Math.max(0.1, Number(m.width_m) || DEFAULT_MODULE.width_m),
    height_m: Math.max(0.1, Number(m.height_m) || DEFAULT_MODULE.height_m),
    thickness_m: Math.max(0.01, Number(m.thickness_m) || DEFAULT_MODULE.thickness_m),
    gap_m: Math.max(0, Number(m.gap_m) ?? DEFAULT_MODULE.gap_m),
    quantity_target: Math.max(1, Math.round(Number(m.quantity_target) || DEFAULT_MODULE.quantity_target)),
    rotation_allowed: m.rotation_allowed !== false,
  };
}

export function etiquetaFromPiengBridge(raw: Partial<Etiqueta> | null | undefined): Etiqueta {
  return hydrateEtiqueta(raw ?? null);
}
