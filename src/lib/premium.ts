import { useSyncExternalStore } from "react";

/**
 * Flag temporária de teste interno (equipe/dev) para o módulo premium
 * (sombreamento). Fica fora do ProjectContext de propósito: não é dado de
 * projeto, não entra no undo/redo nem é salvo em .planosol.json.
 */
const KEY = "pepilene-premium";
const listeners = new Set<() => void>();

export function isPremiumEnabled(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function setPremiumEnabled(value: boolean) {
  if (value) localStorage.setItem(KEY, "1");
  else localStorage.removeItem(KEY);
  listeners.forEach((fn) => fn());
}

export function togglePremium() {
  setPremiumEnabled(!isPremiumEnabled());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePremium(): boolean {
  return useSyncExternalStore(subscribe, isPremiumEnabled, () => false);
}
