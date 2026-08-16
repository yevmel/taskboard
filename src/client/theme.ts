import type { Theme } from "./state.ts";

const STORAGE_KEY = "taskboard-theme";

/**
 * Resolve the theme to use on startup:
 * 1. the value persisted in localStorage, if valid;
 * 2. otherwise the OS preference (prefers-color-scheme);
 * 3. otherwise "light".
 */
export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (e.g. privacy mode); fall through.
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Apply the theme to the document (drives the CSS variable overrides). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** Remember the user's choice for the next visit. */
export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures (e.g. privacy mode).
  }
}
