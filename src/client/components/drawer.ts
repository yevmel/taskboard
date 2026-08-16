import { html } from "lit-html";
import type { TemplateResult } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import type { AppState } from "../state.ts";
import type { Comment, SubtaskDetail, TaskDetail, TaskStatus } from "../../shared/types.ts";
import { quillEditor } from "./quill.ts";
import * as actions from "../actions.ts";

const STATUSES: readonly TaskStatus[] = ["OPEN", "IN PROGRESS", "DONE"];

function commentItem(comment: Comment, onDelete: (commentId: number) => void): TemplateResult {
  return html`
    <li class="comment">
      <div class="comment-body rich-text">${unsafeHTML(comment.body)}</div>
      <footer class="comment-meta">
        <span>${comment.createdBy} · ${comment.createdAt}</span>
        <button class="delete-button" title="Delete comment" @click=${() => onDelete(comment.id)}>Delete</button>
      </footer>
    </li>
  `;
}

function commentsSection(
  comments: Comment[],
  editorKey: string,
  onAdd: () => void,
  onDeleteComment: (commentId: number) => void,
): TemplateResult {
  return html`
    <h3>Comments (${comments.length})</h3>
    <ul class="comments">
      ${comments.length === 0
        ? html`<li class="empty">No comments yet.</li>`
        : comments.map((comment) => commentItem(comment, onDeleteComment))}
    </ul>
    <div class="editor-host comment-editor" ${quillEditor("", editorKey)}></div>
    <div class="editor-actions">
      <button class="primary" @click=${onAdd}>Add comment</button>
    </div>
  `;
}

function descriptionSection(
  description: string,
  editing: boolean,
  showCancel: boolean,
  editorKey: string,
  onSave: () => void,
  onEdit: () => void,
  onCancel: () => void,
): TemplateResult {
  return html`
    ${editing
      ? html`
          <div class="editor-host description-editor" ${quillEditor(description, editorKey)}></div>
          <div class="editor-actions">
            <button class="primary" @click=${onSave}>Save</button>
            ${showCancel ? html`<button @click=${onCancel}>Cancel</button>` : ""}
          </div>
        `
      : html`
          <div class="rich-text">${unsafeHTML(description)}</div>
          <div class="editor-actions">
            <button class="link-button" @click=${onEdit}>Edit</button>
          </div>
        `}
  `;
}

/** Drawer content when a subtask is selected: subtask details + back link. */
function subtaskView(state: AppState, taskId: number, subtask: SubtaskDetail): TemplateResult {
  const commentKey = `subcomment-${subtask.id}-${subtask.comments.length}`;
  const hasDescription = subtask.description.length > 0;
  return html`
    <header class="drawer-header">
      <button class="back" @click=${actions.backToTask}>← Back to task</button>
      <h2 class="drawer-title">${subtask.title}</h2>
      <label class="done-toggle">
        <input type="checkbox" .checked=${subtask.done} @change=${() => actions.toggleSubtask(taskId, subtask.id, !subtask.done)} />
        Done
      </label>
      <button class="icon-button" title="Close" @click=${actions.closeDrawer}>×</button>
    </header>
    <div class="drawer-body">
      <section class="drawer-section">
        <h3>Description</h3>
        ${descriptionSection(
          subtask.description,
          state.editingSubtaskDescription || !hasDescription,
          hasDescription,
          `desc-subtask-${subtask.id}`,
          () => actions.saveSubtaskDescription(taskId, subtask.id),
          actions.startEditSubtaskDescription,
          actions.cancelEditSubtaskDescription,
        )}
      </section>
      <section class="drawer-section">
        ${commentsSection(
          subtask.comments,
          commentKey,
          () => actions.addSubtaskComment(taskId, subtask.id),
          (commentId) => actions.removeSubtaskComment(taskId, subtask.id, commentId),
        )}
      </section>
      <footer class="drawer-meta">Created ${subtask.createdAt} by ${subtask.createdBy}</footer>
    </div>
  `;
}

/** Drawer content for the selected task: full details. */
function taskView(state: AppState, task: TaskDetail): TemplateResult {
  const commentKey = `comment-${task.id}-${task.comments.length}`;
  const hasDescription = task.description.length > 0;
  return html`
    <header class="drawer-header">
      <h2 class="drawer-title">${task.title}</h2>
      <label class="status-select">
        <span>Status</span>
        <select
          @change=${(event: Event) =>
            actions.changeTaskStatus(task.id, (event.target as HTMLSelectElement).value as TaskStatus)}
        >
          ${STATUSES.map(
            (status) => html`<option value=${status} .selected=${status === task.status}>${status}</option>`,
          )}
        </select>
      </label>
      <button class="delete-button" @click=${() => actions.removeTask(task.id)}>Delete</button>
      <button class="icon-button" title="Close" @click=${actions.closeDrawer}>×</button>
    </header>

    <div class="drawer-body">
      <section class="drawer-section">
        <h3>Description</h3>
        ${descriptionSection(
          task.description,
          state.editingDescription || !hasDescription,
          hasDescription,
          `desc-${task.id}`,
          () => actions.saveDescription(task.id),
          actions.startEditDescription,
          actions.cancelEditDescription,
        )}
      </section>

      <section class="drawer-section">
        <h3>Subtasks (${task.subtasks.length})</h3>
        <ul class="drawer-subtasks">
          ${task.subtasks.length === 0
            ? html`<li class="empty">No subtasks yet.</li>`
            : task.subtasks.map(
                (subtask) => html`
                  <li class="drawer-subtask ${subtask.done ? "done" : ""}">
                    <input
                      type="checkbox"
                      .checked=${subtask.done}
                      @change=${() => actions.toggleSubtask(task.id, subtask.id, !subtask.done)}
                    />
                    <button class="subtask-link" @click=${() => actions.openSubtask(task.id, subtask.id)}>
                      ${subtask.title}
                    </button>
                    <button
                      class="delete-button"
                      title="Delete subtask"
                      @click=${() => actions.removeSubtask(task.id, subtask.id)}
                    >
                      Delete
                    </button>
                  </li>
                `,
              )}
        </ul>
        <form
          class="add-subtask"
          @submit=${(event: SubmitEvent) => {
            event.preventDefault();
            const form = event.currentTarget as HTMLFormElement;
            const input = form.elements.namedItem("title") as HTMLInputElement | null;
            const title = input?.value.trim() ?? "";
            if (title.length === 0) return;
            void actions.addSubtask(task.id, title);
            form.reset();
          }}
        >
          <input name="title" placeholder="New subtask title" required />
          <button type="submit" class="primary">Add subtask</button>
        </form>
      </section>

      <section class="drawer-section">
        ${commentsSection(
          task.comments,
          commentKey,
          () => actions.addTaskComment(task.id),
          (commentId) => actions.removeTaskComment(task.id, commentId),
        )}
      </section>

      <footer class="drawer-meta">Created ${task.createdAt} by ${task.createdBy}</footer>
    </div>
  `;
}

/** The right-hand drawer: backdrop + sliding panel. */
export function drawer(state: AppState): TemplateResult {
  const taskId = state.selectedTaskId;
  if (taskId === null) return html``;

  const task = state.details[taskId];
  const listTask = state.tasks?.find((t) => t.id === taskId);
  const selectedSubtaskId = state.selectedSubtaskId;
  const subtask = selectedSubtaskId !== null ? state.subtaskDetails[selectedSubtaskId] : undefined;

  return html`
    <div class="drawer-backdrop" @click=${actions.closeDrawer}></div>
    <aside class="drawer">
      ${subtask
        ? subtaskView(state, taskId, subtask)
        : task
          ? taskView(state, task)
          : listTask
            ? html`<div class="drawer-loading"><p>Loading details…</p></div>`
            : html`<div class="drawer-loading"><p>Loading…</p></div>`}
    </aside>
  `;
}
