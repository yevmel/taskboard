import { html } from "lit-html";
import type { TemplateResult } from "lit-html";
import type { AppState } from "../state.ts";
import { getEditorHtml, quillEditor } from "./quill.ts";
import * as actions from "../actions.ts";

/** Key of the description editor in the new-task modal. */
const DESCRIPTION_KEY = "new-task-desc";

function submitTaskForm(event: SubmitEvent): void {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const titleInput = form.elements.namedItem("title") as HTMLInputElement | null;

  const title = titleInput?.value.trim() ?? "";
  if (title.length === 0) return;

  const description = getEditorHtml(DESCRIPTION_KEY);
  void actions.createTask(title, description);
}

/** Modal dialog for creating a new task. New tasks are always created as OPEN. */
export function taskForm(state: AppState): TemplateResult {
  if (!state.taskForm.open) return html``;
  return html`
    <div class="modal-backdrop" @click=${actions.closeTaskForm}></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="New task">
      <header class="modal-header">
        <h2>New task</h2>
        <button class="icon-button" title="Close" @click=${actions.closeTaskForm}>×</button>
      </header>
      <form class="modal-body" @submit=${submitTaskForm}>
        <label class="field">
          <span>Title</span>
          <input name="title" placeholder="Task title" required autofocus />
        </label>
        <div class="field">
          <span>Description</span>
          <div class="editor-wrap">
            <div class="editor-host" ${quillEditor("", DESCRIPTION_KEY)}></div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" @click=${actions.closeTaskForm}>Cancel</button>
          <button type="submit" class="primary">Create task</button>
        </div>
      </form>
    </div>
  `;
}
