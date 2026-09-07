import { useSyncExternalStore } from "react";
import bundledCatalog from "../../module_catalog.json";
import type { ModuleSpec } from "../types";
import { persistApiAvailable } from "../persist/client";

export interface CatalogModule {
  id: string;
  brand: string;
  model: string;
  power_w: number;
  width_m: number;
  height_m: number;
  thickness_m: number;
  gap_m: number;
  notes?: string;
}

export interface ModuleCatalogFile {
  default_id: string;
  modules: CatalogModule[];
}

const STORAGE_KEY = "planosol-module-catalog";

type Listener = () => void;

const listeners = new Set<Listener>();

function cloneCatalog(src: ModuleCatalogFile): ModuleCatalogFile {
  return {
    default_id: src.default_id,
    modules: (src.modules ?? []).map((m) => ({ ...m })),
  };
}

function normalizeCatalog(raw: unknown): ModuleCatalogFile | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as ModuleCatalogFile;
  if (!Array.isArray(data.modules) || data.modules.length === 0) return null;
  const modules = data.modules.map((m, i) => ({
    id: String(m.id || `mod-${i + 1}`),
    brand: String(m.brand || "MARCA"),
    model: String(m.model || "modelo"),
    power_w: Math.max(1, Number(m.power_w) || 1),
    width_m: Math.max(0.1, Number(m.width_m) || 1),
    height_m: Math.max(0.1, Number(m.height_m) || 1),
    thickness_m: Math.max(0.001, Number(m.thickness_m) || 0.03),
    gap_m: Math.max(0, Number(m.gap_m) || 0),
    notes: m.notes ? String(m.notes) : undefined,
  }));
  const ids = new Set(modules.map((m) => m.id));
  const default_id = data.default_id && ids.has(data.default_id) ? data.default_id : modules[0].id;
  return { default_id, modules };
}

function readLocalStorageCatalog(): ModuleCatalogFile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeCatalog(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalStorageCatalog(catalog: ModuleCatalogFile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    /* quota / private mode */
  }
}

let runtimeCatalog: ModuleCatalogFile = cloneCatalog(
  (readLocalStorageCatalog() ?? (bundledCatalog as ModuleCatalogFile)) as ModuleCatalogFile,
);

function emit() {
  listeners.forEach((l) => l());
}

export function getModuleCatalog(): ModuleCatalogFile {
  return runtimeCatalog;
}

export function subscribeModuleCatalog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useModuleCatalog(): ModuleCatalogFile {
  return useSyncExternalStore(subscribeModuleCatalog, getModuleCatalog, getModuleCatalog);
}

export function listCatalogModules(): CatalogModule[] {
  return getModuleCatalog().modules;
}

export function getCatalogModule(id: string): CatalogModule | undefined {
  return listCatalogModules().find((m) => m.id === id);
}

export function matchCatalogId(module: Pick<ModuleSpec, "brand" | "model" | "power_w">): string {
  const hit = listCatalogModules().find(
    (m) =>
      m.brand.toLowerCase() === module.brand.trim().toLowerCase() &&
      m.model.toLowerCase() === module.model.trim().toLowerCase() &&
      m.power_w === module.power_w,
  );
  return hit?.id ?? "";
}

export function catalogToModulePatch(
  item: CatalogModule,
  current: ModuleSpec,
): Partial<ModuleSpec> {
  return {
    brand: item.brand,
    model: item.model,
    power_w: item.power_w,
    width_m: item.width_m,
    height_m: item.height_m,
    thickness_m: item.thickness_m,
    gap_m: item.gap_m,
    quantity_target: current.quantity_target,
    rotation_allowed: current.rotation_allowed,
  };
}

export function catalogLabel(item: CatalogModule): string {
  return `${item.brand} ${item.model} · ${item.power_w} W (${item.width_m.toFixed(3)}×${item.height_m.toFixed(3)} m)`;
}

export function slugCatalogId(brand: string, power_w: number): string {
  return (
    `${brand}-${power_w}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 48) || `mod-${power_w}`
  );
}

function applyCatalog(next: ModuleCatalogFile) {
  runtimeCatalog = cloneCatalog(next);
  writeLocalStorageCatalog(runtimeCatalog);
  emit();
}

export type SaveCatalogResult = {
  catalog: ModuleCatalogFile;
  savedToDisk: boolean;
  savedToBrowser: boolean;
  message: string;
};

/** Grava catálogo: disco (PC) + sempre localStorage (nuvem/sessão). */
export async function saveModuleCatalog(catalog: ModuleCatalogFile): Promise<SaveCatalogResult> {
  const normalized = normalizeCatalog(catalog);
  if (!normalized) throw new Error("Catálogo inválido.");

  if (await persistApiAvailable()) {
    const res = await fetch("/api/persist/module-catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Falha ao gravar module_catalog.json (${res.status})`);
    }
    const fromDisk = normalizeCatalog(await res.json());
    if (fromDisk) {
      applyCatalog(fromDisk);
      return {
        catalog: fromDisk,
        savedToDisk: true,
        savedToBrowser: true,
        message: "Catálogo gravado em module_catalog.json e neste navegador.",
      };
    }
  }

  applyCatalog(normalized);
  return {
    catalog: normalized,
    savedToDisk: false,
    savedToBrowser: true,
    message:
      "Catálogo gravado neste navegador (nuvem). Use «Baixar JSON» e substitua module_catalog.json no repo para o deploy.",
  };
}

export function downloadModuleCatalogJson(catalog: ModuleCatalogFile = getModuleCatalog()) {
  const blob = new Blob([`${JSON.stringify(catalog, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "module_catalog.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function emptyCatalogDraft(from?: CatalogModule): CatalogModule {
  if (from) return { ...from };
  return {
    id: "",
    brand: "RENEPV",
    model: "680W",
    power_w: 680,
    width_m: 2.384,
    height_m: 1.303,
    thickness_m: 0.033,
    gap_m: 0.02,
    notes: "",
  };
}

/** Sincroniza do disco (dev) se não houver override local mais novo — chamado no boot. */
export async function hydrateModuleCatalogFromDisk(): Promise<void> {
  const local = readLocalStorageCatalog();
  if (local) {
    applyCatalog(local);
    return;
  }
  if (!(await persistApiAvailable())) return;
  try {
    const res = await fetch("/api/persist/module-catalog");
    if (!res.ok) return;
    const data = normalizeCatalog(await res.json());
    if (data) applyCatalog(data);
  } catch {
    /* mantém bundled */
  }
}

export function resetModuleCatalogToBundled(): ModuleCatalogFile {
  const next = cloneCatalog(bundledCatalog as ModuleCatalogFile);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  runtimeCatalog = next;
  emit();
  return next;
}
