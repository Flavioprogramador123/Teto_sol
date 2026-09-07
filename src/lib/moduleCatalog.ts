import catalogJson from "../../module_catalog.json";
import type { ModuleSpec } from "../types";

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

export const MODULE_CATALOG = catalogJson as ModuleCatalogFile;

export function listCatalogModules(): CatalogModule[] {
  return MODULE_CATALOG.modules ?? [];
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

/** Aplica ficha do catálogo; preserva quantidade e rotação do projeto. */
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
