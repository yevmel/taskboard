import { api } from "./api.ts";
import { dispatch, getState } from "./store.ts";
import { getEditorHtml } from "./components/quill.ts";
import type { CreateTaskInput, TaskStatus } from "../shared/types.ts";

/**
 * Async action creators: perform API calls and dispatch resulting actions.
 * Components never touch the API or the store directly; they call these.
 */

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadTasks(): Promise<void> {
  try {
    const tasks = await api.listTasks();
    dispatch({ type: "TASKS_LOADED", tasks });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function openTask(taskId: number): Promise<void> {
  dispatch({ type: "SELECT_TASK", taskId });
  try {
    const task = await api.getTask(taskId);
    dispatch({ type: "TASK_DETAIL_LOADED", task });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export function openTaskForm(): void {
  dispatch({ type: "OPEN_TASK_FORM" });
}

export function closeTaskForm(): void {
  dispatch({ type: "CLOSE_TASK_FORM" });
}

export function toggleTheme(): void {
  dispatch({ type: "TOGGLE_THEME" });
}

export async function createTask(title: string, description: string): Promise<void> {
  // New tasks are always created with status OPEN (the API rejects any status).
  const input: CreateTaskInput = { title };
  if (description.length > 0) input.description = description;
  try {
    const task = await api.createTask(input);
    dispatch({ type: "TASK_CREATED", task });
    dispatch({ type: "CLOSE_TASK_FORM" });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export function closeDrawer(): void {
  dispatch({ type: "SELECT_TASK", taskId: null });
}

/** Refetch the currently open task's detail without changing the selection. */
export async function resyncOpenTaskDetail(): Promise<void> {
  const taskId = getState().selectedTaskId;
  if (taskId === null) return;
  try {
    const task = await api.getTask(taskId);
    dispatch({ type: "TASK_DETAIL_LOADED", task });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export function toggleDescription(taskId: number): void {
  dispatch({ type: "TOGGLE_DESCRIPTION", taskId });
}

export function startEditDescription(): void {
  dispatch({ type: "SET_EDITING_DESCRIPTION", editing: true });
}

export function cancelEditDescription(): void {
  dispatch({ type: "SET_EDITING_DESCRIPTION", editing: false });
}

export async function saveDescription(taskId: number): Promise<void> {
  const description = getEditorHtml(`desc-${taskId}`);
  try {
    const task = await api.updateTask(taskId, { description });
    dispatch({ type: "TASK_UPDATED", task });
    dispatch({ type: "SET_EDITING_DESCRIPTION", editing: false });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export function startEditSubtaskDescription(): void {
  dispatch({ type: "SET_EDITING_SUBTASK_DESCRIPTION", editing: true });
}

export function cancelEditSubtaskDescription(): void {
  dispatch({ type: "SET_EDITING_SUBTASK_DESCRIPTION", editing: false });
}

export async function saveSubtaskDescription(taskId: number, subtaskId: number): Promise<void> {
  const description = getEditorHtml(`desc-subtask-${subtaskId}`);
  try {
    const subtask = await api.updateSubtask(taskId, subtaskId, { description });
    dispatch({ type: "SUBTASK_UPDATED", taskId, subtask });
    dispatch({ type: "SET_EDITING_SUBTASK_DESCRIPTION", editing: false });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function changeTaskStatus(taskId: number, status: TaskStatus): Promise<void> {
  try {
    const task = await api.updateTask(taskId, { status });
    dispatch({ type: "TASK_UPDATED", task });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function addSubtask(taskId: number, title: string): Promise<void> {
  try {
    const subtask = await api.addSubtask(taskId, { title });
    dispatch({ type: "SUBTASK_ADDED", taskId, subtask });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function removeSubtask(taskId: number, subtaskId: number): Promise<void> {
  try {
    await api.deleteSubtask(taskId, subtaskId);
    dispatch({ type: "SUBTASK_REMOVED", taskId, subtaskId });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function toggleSubtask(taskId: number, subtaskId: number, done: boolean): Promise<void> {
  try {
    const subtask = await api.updateSubtask(taskId, subtaskId, { done });
    dispatch({ type: "SUBTASK_UPDATED", taskId, subtask });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function openSubtask(taskId: number, subtaskId: number): Promise<void> {
  dispatch({ type: "SELECT_TASK", taskId });
  dispatch({ type: "SELECT_SUBTASK", subtaskId });
  try {
    const [subtask, task] = await Promise.all([api.getSubtask(taskId, subtaskId), api.getTask(taskId)]);
    dispatch({ type: "SUBTASK_DETAIL_LOADED", subtask });
    dispatch({ type: "TASK_DETAIL_LOADED", task });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export function backToTask(): void {
  dispatch({ type: "SELECT_SUBTASK", subtaskId: null });
}

export async function removeTask(taskId: number): Promise<void> {
  if (!window.confirm("Delete this task and all of its subtasks and comments?")) return;
  try {
    await api.deleteTask(taskId);
    dispatch({ type: "TASK_REMOVED", taskId });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function removeTaskComment(taskId: number, commentId: number): Promise<void> {
  try {
    await api.deleteTaskComment(taskId, commentId);
    dispatch({ type: "COMMENT_REMOVED", taskId, commentId });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function removeSubtaskComment(taskId: number, subtaskId: number, commentId: number): Promise<void> {
  try {
    await api.deleteSubtaskComment(taskId, subtaskId, commentId);
    dispatch({ type: "SUBTASK_COMMENT_REMOVED", subtaskId, commentId });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function addTaskComment(taskId: number): Promise<void> {
  const comments = getState().details[taskId]?.comments ?? [];
  const body = getEditorHtml(`comment-${taskId}-${comments.length}`);
  if (body.trim().length === 0) return;
  try {
    const comment = await api.addComment(taskId, body);
    dispatch({ type: "COMMENT_ADDED", taskId, comment });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}

export async function addSubtaskComment(taskId: number, subtaskId: number): Promise<void> {
  const comments = getState().subtaskDetails[subtaskId]?.comments ?? [];
  const body = getEditorHtml(`subcomment-${subtaskId}-${comments.length}`);
  if (body.trim().length === 0) return;
  try {
    const comment = await api.addSubtaskComment(taskId, subtaskId, body);
    dispatch({ type: "SUBTASK_COMMENT_ADDED", subtaskId, comment });
  } catch (error) {
    dispatch({ type: "SET_ERROR", error: errorMessage(error) });
  }
}
