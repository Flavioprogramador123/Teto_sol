import pkg from "../../package.json";

/** Versão semver do app (`package.json`). Use `npm run bump:patch|minor|major`. */
export const APP_VERSION = pkg.version;

export const APP_VERSION_LABEL = `v${APP_VERSION}`;
