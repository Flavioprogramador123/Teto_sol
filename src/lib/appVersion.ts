/** Versão injetada no build (`vite.config` → `__APP_VERSION__`). */
declare const __APP_VERSION__: string;

export const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__ ? __APP_VERSION__ : "0.0.0-dev";

export const APP_VERSION_LABEL = `v${APP_VERSION}`;
