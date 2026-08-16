import { html } from "lit-html";
import type { TemplateResult } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import type { AppState } from "../state.ts";
import type { TaskSummary } from "../../shared/types.ts";
import { openSubtask, openTask, toggleDescription, toggleSubtask } from "../actions.ts";

const EXCERPT_LIMIT = 120;

/** Strip tags from HTML to produce a plain-text excerpt. */
function plainText(htmlString: string): string {
  return htmlString
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** A task card in a board column. */
export function taskCard(task: TaskSummary, state: AppState): TemplateResult {
  const text = plainText(task.description);
  const truncated = text.length > EXCERPT_LIMIT;
  const expanded = state.expanded[task.id] === true;

  return html`
    <article class="task-card">
      <div class="task-card-main" @click=${() => openTask(task.id)}>
        <h3 class="task-title">${task.title}</h3>

        <div class="task-description">
          ${truncated && !expanded
            ? html`<p class="excerpt">${text.slice(0, EXCERPT_LIMIT).trimEnd()}…</p>`
            : html`<div class="rich-text">${unsafeHTML(task.description)}</div>`}
          ${truncated
            ? html`<button
                class="link-button"
                @click=${(event: Event) => {
                  event.stopPropagation();
                  toggleDescription(task.id);
                }}
              >
                ${expanded ? "less" : "more"}
              </button>`
            : ""}
        </div>

        ${task.subtasks.length > 0
          ? html`<ul class="subtask-list">
              ${task.subtasks.map(
                (subtask) => html`
                  <li
                    class="subtask-item ${subtask.done ? "done" : ""}"
                    @click=${(event: Event) => {
                      event.stopPropagation();
                      openSubtask(task.id, subtask.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      .checked=${subtask.done}
                      @click=${(event: Event) => event.stopPropagation()}
                      @change=${() => toggleSubtask(task.id, subtask.id, !subtask.done)}
                    />
                    <span class="subtask-title">${subtask.title}</span>
                  </li>
                `,
              )}
            </ul>`
          : ""}

        <footer class="task-meta">Created ${task.createdAt} by ${task.createdBy}</footer>
      </div>
    </article>
  `;
}
