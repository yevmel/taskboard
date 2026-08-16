import { html, render } from "lit-html";
import type { TemplateResult } from "lit-html";
import type { Action, AppState } from "./state.ts";
import { initialState, reducer } from "./state.ts";
import { applyTheme, persistTheme } from "./theme.ts";

/**
 * Redux-style store.
 *
 * - The application state is a single global object that is never mutated
 *   directly; every change goes through `dispatch(action)`.
 * - `dispatch` applies the reducer, replaces the state and schedules a re-render
 *   on `requestAnimationFrame` — `render` is never called directly by
 *   components.
 * - Theme changes are pushed to the document and persisted as a side effect of
 *   `dispatch`.
 */

let state: AppState = initialState;
let container: HTMLElement | null = null;
let view: (state: AppState) => TemplateResult = () => html``;
let renderScheduled = false;

/** Attach the store to a DOM container and the root view function. */
export function initStore(
  root: HTMLElement,
  viewFn: (state: AppState) => TemplateResult,
  overrides: Partial<AppState> = {},
): void {
  state = { ...initialState, ...overrides };
  container = root;
  view = viewFn;
  scheduleRender();
}

export function getState(): AppState {
  return state;
}

export function dispatch(action: Action): void {
  const previousTheme = state.theme;
  state = reducer(state, action);
  if (state.theme !== previousTheme) {
    applyTheme(state.theme);
    persistTheme(state.theme);
  }
  scheduleRender();
}

function scheduleRender(): void {
  if (renderScheduled || container === null) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (container !== null) render(view(state), container);
  });
}
