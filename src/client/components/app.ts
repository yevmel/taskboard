import { html } from "lit-html";
import type { TemplateResult } from "lit-html";
import type { AppState } from "../state.ts";
import { board } from "./board.ts";
import { drawer } from "./drawer.ts";
import { taskForm } from "./task-form.ts";
import { toggleTheme } from "../actions.ts";

/** Moon icon — shown while the light theme is active (click to go dark). */
const MOON_ICON = html`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
`;

/** Sun icon — shown while the dark theme is active (click to go light). */
const SUN_ICON = html`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
`;

/** Root view: header + three-column board + right drawer (when a task is open). */
export function app(state: AppState): TemplateResult {
  const dark = state.theme === "dark";
  return html`
    <header class="app-header">
      <h1>TaskBoard</h1>
      <button
        class="theme-toggle"
        title=${dark ? "Switch to light theme" : "Switch to dark theme"}
        aria-label=${dark ? "Switch to light theme" : "Switch to dark theme"}
        @click=${toggleTheme}
      >
        ${dark ? SUN_ICON : MOON_ICON}
      </button>
    </header>
    ${state.error ? html`<div class="error-banner">${state.error}</div>` : ""}
    ${board(state)}
    ${state.selectedTaskId !== null ? drawer(state) : ""}
    ${taskForm(state)}
  `;
}
