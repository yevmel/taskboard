import { html } from "lit-html";
import type { TemplateResult } from "lit-html";
import type { AppState } from "../state.ts";
import type { TaskStatus } from "../../shared/types.ts";
import { taskCard } from "./task-card.ts";
import { openTaskForm } from "../actions.ts";

const COLUMNS: readonly TaskStatus[] = ["OPEN", "IN PROGRESS", "DONE"];

/** Three-column board: one column per task status. */
export function board(state: AppState): TemplateResult {
  const tasks = state.tasks;
  if (tasks === null) {
    return html`<main class="board"><p class="board-loading">Loading tasks…</p></main>`;
  }

  return html`
    <main class="board">
      ${COLUMNS.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return html`
          <section class="column" data-status="${status}">
            <header class="column-header">
              <h2>${status}</h2>
              <span class="column-header-actions">
                <span class="column-count">${columnTasks.length}</span>
                ${status === "OPEN"
                  ? html`<button class="add-task-button" title="New task" @click=${openTaskForm}>New Task</button>`
                  : ""}
              </span>
            </header>
            <div class="column-body">
              ${columnTasks.length === 0
                ? html`<p class="column-empty">No tasks</p>`
                : columnTasks.map((task) => taskCard(task, state))}
            </div>
          </section>
        `;
      })}
    </main>
  `;
}
