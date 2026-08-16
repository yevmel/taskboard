import type { Comment, SubtaskDetail, TaskDetail, TaskSummary } from "../shared/types.ts";

/** The active color theme. */
export type Theme = "light" | "dark";

/**
 * The single global application state.
 *
 * State is never mutated directly. All changes go through `dispatch(action)` in
 * `store.ts`, which applies the reducer and schedules a re-render on rAF.
 */
export interface AppState {
  /** Active color theme (light or dark). */
  theme: Theme;
  /** Tasks as returned by the list endpoint (subtasks without comments). */
  tasks: TaskSummary[] | null;
  /** Task details (with comments) keyed by task id, fetched on demand. */
  details: Record<number, TaskDetail>;
  /** Subtask details (with comments) keyed by subtask id. */
  subtaskDetails: Record<number, SubtaskDetail>;
  /** Id of the task currently shown in the drawer (null = drawer closed). */
  selectedTaskId: number | null;
  /** Id of the subtask currently shown in the drawer (null = task view). */
  selectedSubtaskId: number | null;
  /** Task ids whose card description is expanded ("less" state). */
  expanded: Record<number, boolean>;
  /** Whether the task description editor in the drawer is active. */
  editingDescription: boolean;
  /** Whether the subtask description editor in the drawer is active. */
  editingSubtaskDescription: boolean;
  /** Whether the "new task" modal form is open. */
  taskForm: { open: boolean };
  /** Last API error to display, if any. */
  error: string | null;
}

export const initialState: AppState = {
  theme: "light",
  tasks: null,
  details: {},
  subtaskDetails: {},
  selectedTaskId: null,
  selectedSubtaskId: null,
  expanded: {},
  editingDescription: false,
  editingSubtaskDescription: false,
  taskForm: { open: false },
  error: null,
};

export type Action =
  | { type: "TASKS_LOADED"; tasks: TaskSummary[] }
  | { type: "TASK_CREATED"; task: TaskDetail }
  | { type: "TASK_DETAIL_LOADED"; task: TaskDetail }
  | { type: "TASK_UPDATED"; task: TaskDetail }
  | { type: "SUBTASK_DETAIL_LOADED"; subtask: SubtaskDetail }
  | { type: "SUBTASK_ADDED"; taskId: number; subtask: SubtaskDetail }
  | { type: "SUBTASK_REMOVED"; taskId: number; subtaskId: number }
  | { type: "SUBTASK_UPDATED"; taskId: number; subtask: SubtaskDetail }
  | { type: "COMMENT_ADDED"; taskId: number; comment: Comment }
  | { type: "SUBTASK_COMMENT_ADDED"; subtaskId: number; comment: Comment }
  | { type: "SELECT_TASK"; taskId: number | null }
  | { type: "SELECT_SUBTASK"; subtaskId: number | null }
  | { type: "TOGGLE_DESCRIPTION"; taskId: number }
  | { type: "SET_EDITING_DESCRIPTION"; editing: boolean }
  | { type: "SET_EDITING_SUBTASK_DESCRIPTION"; editing: boolean }
  | { type: "OPEN_TASK_FORM" }
  | { type: "CLOSE_TASK_FORM" }
  | { type: "TOGGLE_THEME" }
  | { type: "TASK_REMOVED"; taskId: number }
  | { type: "COMMENT_REMOVED"; taskId: number; commentId: number }
  | { type: "SUBTASK_COMMENT_REMOVED"; subtaskId: number; commentId: number }
  | { type: "SET_ERROR"; error: string | null };

/** Shrink a subtask detail into the summary shape used by task lists. */
function toSummary(subtask: SubtaskDetail): { id: number; title: string; done: boolean } {
  return { id: subtask.id, title: subtask.title, done: subtask.done };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "TASKS_LOADED":
      return { ...state, tasks: action.tasks, error: null };

    case "TASK_CREATED": {
      const task = action.task;
      const summary = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        subtasks: task.subtasks.map((subtask) => ({ id: subtask.id, title: subtask.title, done: subtask.done })),
        createdAt: task.createdAt,
        createdBy: task.createdBy,
      };
      const tasks = state.tasks ? [...state.tasks, summary].sort((a, b) => a.id - b.id) : null;
      return { ...state, tasks, details: { ...state.details, [task.id]: task } };
    }

    case "TASK_DETAIL_LOADED": {
      const task = action.task;
      const tasks = state.tasks
        ? state.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  title: task.title,
                  description: task.description,
                  status: task.status,
                  subtasks: task.subtasks.map(toSummary),
                }
              : t,
          )
        : null;
      return { ...state, tasks, details: { ...state.details, [task.id]: task } };
    }

    case "TASK_UPDATED": {
      const task = action.task;
      const tasks = state.tasks
        ? state.tasks.map((t) =>
            t.id === task.id
              ? { ...t, title: task.title, description: task.description, status: task.status }
              : t,
          )
        : null;
      const detail = state.details[task.id];
      const details = detail ? { ...state.details, [task.id]: { ...detail, ...task } } : state.details;
      return { ...state, tasks, details };
    }

    case "SUBTASK_DETAIL_LOADED":
      return { ...state, subtaskDetails: { ...state.subtaskDetails, [action.subtask.id]: action.subtask } };

    case "SUBTASK_ADDED": {
      const { taskId, subtask } = action;
      const tasks = state.tasks
        ? state.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: [...t.subtasks, toSummary(subtask)] } : t))
        : null;
      const detail = state.details[taskId];
      const details = detail
        ? { ...state.details, [taskId]: { ...detail, subtasks: [...detail.subtasks, subtask] } }
        : state.details;
      return { ...state, tasks, details, subtaskDetails: { ...state.subtaskDetails, [subtask.id]: subtask } };
    }

    case "SUBTASK_REMOVED": {
      const { taskId, subtaskId } = action;
      const tasks = state.tasks
        ? state.tasks.map((t) =>
            t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t,
          )
        : null;
      const detail = state.details[taskId];
      const details = detail
        ? { ...state.details, [taskId]: { ...detail, subtasks: detail.subtasks.filter((s) => s.id !== subtaskId) } }
        : state.details;
      const subtaskDetails = { ...state.subtaskDetails };
      delete subtaskDetails[subtaskId];
      return {
        ...state,
        tasks,
        details,
        subtaskDetails,
        selectedSubtaskId: state.selectedSubtaskId === subtaskId ? null : state.selectedSubtaskId,
      };
    }

    case "SUBTASK_UPDATED": {
      const { taskId, subtask } = action;
      const tasks = state.tasks
        ? state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subtask.id ? toSummary(subtask) : s)) }
              : t,
          )
        : null;
      const detail = state.details[taskId];
      const details = detail
        ? {
            ...state.details,
            [taskId]: { ...detail, subtasks: detail.subtasks.map((s) => (s.id === subtask.id ? subtask : s)) },
          }
        : state.details;
      return { ...state, tasks, details, subtaskDetails: { ...state.subtaskDetails, [subtask.id]: subtask } };
    }

    case "COMMENT_ADDED": {
      const detail = state.details[action.taskId];
      const details = detail
        ? { ...state.details, [action.taskId]: { ...detail, comments: [...detail.comments, action.comment] } }
        : state.details;
      return { ...state, details };
    }

    case "SUBTASK_COMMENT_ADDED": {
      const detail = state.subtaskDetails[action.subtaskId];
      const subtaskDetails = detail
        ? {
            ...state.subtaskDetails,
            [action.subtaskId]: { ...detail, comments: [...detail.comments, action.comment] },
          }
        : state.subtaskDetails;
      return { ...state, subtaskDetails };
    }

    case "TASK_REMOVED": {
      const { taskId } = action;
      const tasks = state.tasks ? state.tasks.filter((task) => task.id !== taskId) : null;
      const details = { ...state.details };
      delete details[taskId];
      // Subtask details are keyed by subtask id only; drop them all when a task
      // disappears (they belong to the deleted task and are refetched on demand).
      const selected = state.selectedTaskId === taskId;
      return {
        ...state,
        tasks,
        details,
        subtaskDetails: {},
        selectedTaskId: selected ? null : state.selectedTaskId,
        selectedSubtaskId: selected ? null : state.selectedSubtaskId,
        editingDescription: selected ? false : state.editingDescription,
        editingSubtaskDescription: selected ? false : state.editingSubtaskDescription,
      };
    }

    case "COMMENT_REMOVED": {
      const detail = state.details[action.taskId];
      const details = detail
        ? {
            ...state.details,
            [action.taskId]: { ...detail, comments: detail.comments.filter((c) => c.id !== action.commentId) },
          }
        : state.details;
      return { ...state, details };
    }

    case "SUBTASK_COMMENT_REMOVED": {
      const detail = state.subtaskDetails[action.subtaskId];
      const subtaskDetails = detail
        ? {
            ...state.subtaskDetails,
            [action.subtaskId]: {
              ...detail,
              comments: detail.comments.filter((c) => c.id !== action.commentId),
            },
          }
        : state.subtaskDetails;
      return { ...state, subtaskDetails };
    }

    case "SELECT_TASK":
      return {
        ...state,
        selectedTaskId: action.taskId,
        selectedSubtaskId: action.taskId === null ? null : state.selectedSubtaskId,
        editingDescription: false,
        editingSubtaskDescription: false,
      };

    case "SELECT_SUBTASK":
      return { ...state, selectedSubtaskId: action.subtaskId, editingSubtaskDescription: false };

    case "TOGGLE_DESCRIPTION":
      return { ...state, expanded: { ...state.expanded, [action.taskId]: !(state.expanded[action.taskId] ?? false) } };

    case "SET_EDITING_DESCRIPTION":
      return { ...state, editingDescription: action.editing };

    case "SET_EDITING_SUBTASK_DESCRIPTION":
      return { ...state, editingSubtaskDescription: action.editing };

    case "OPEN_TASK_FORM":
      return { ...state, taskForm: { open: true } };

    case "CLOSE_TASK_FORM":
      return { ...state, taskForm: { ...state.taskForm, open: false } };

    case "TOGGLE_THEME":
      return { ...state, theme: state.theme === "light" ? "dark" : "light" };

    case "SET_ERROR":
      return { ...state, error: action.error };
  }
}
