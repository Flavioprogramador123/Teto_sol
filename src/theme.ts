export type AppTheme = "claro" | "escuro";

export const THEME_KEY = "pepilene-theme";

export function readTheme(): AppTheme {
  return localStorage.getItem(THEME_KEY) === "claro" ? "claro" : "escuro";
}

export function applyTheme(theme: AppTheme) {
  document.documentElement.classList.toggle("theme-claro", theme === "claro");
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

applyTheme(readTheme());
