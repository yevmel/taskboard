/**
 * Shared domain types for TaskBoard.
 *
 * These types describe the wire format of the REST API and are used by both the
 * server (src/server) and the client (src/client).
 */

/** Lifecycle status of a task. */
export type TaskStatus = "OPEN" | "IN PROGRESS" | "DONE";

/**
 * Rich text, stored as sanitized HTML.
 *
 * Descriptions and comment bodies arrive over the API as HTML strings and are
 * sanitized server-side (see `src/server/sanitize.ts`) before being persisted.
 */
export type Html = string;

/** A comment attached to a task or a subtask. */
export interface Comment {
  id: number;
  /** Rich text body (sanitized HTML). */
  body: Html;
  /** Timestamp in UTC, formatted as "YYYY-MM-DD HH:mm:ss". */
  createdAt: string;
  /** Username of the author, or "unknown" when no username was provided. */
  createdBy: string;
}

/** A subtask as it appears inside a task list (without comments). */
export interface SubtaskSummary {
  id: number;
  title: string;
  done: boolean;
}

/** Full subtask details, including its comments. */
export interface SubtaskDetail {
  id: number;
  title: string;
  description: Html;
  done: boolean;
  comments: Comment[];
  createdAt: string;
  createdBy: string;
}

/** A task as it appears in the task list (subtasks without comments). */
export interface TaskSummary {
  id: number;
  title: string;
  description: Html;
  status: TaskStatus;
  subtasks: SubtaskSummary[];
  createdAt: string;
  createdBy: string;
}

/** Full task details, including subtasks (with their comments) and the task's own comments. */
export interface TaskDetail {
  id: number;
  title: string;
  description: Html;
  status: TaskStatus;
  subtasks: SubtaskDetail[];
  comments: Comment[];
  createdAt: string;
  createdBy: string;
}

export interface CreateTaskInput {
  title: string;
  description?: Html;
  /**
   * Note: the status of a task cannot be set at creation time — new tasks are
   * always created with status OPEN.
   */
  createdBy?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: Html;
  status?: TaskStatus;
  createdBy?: string;
}

export interface CreateSubtaskInput {
  title: string;
  description?: Html;
  createdBy?: string;
}

export interface UpdateSubtaskInput {
  title?: string;
  description?: Html;
  done?: boolean;
  createdBy?: string;
}

export interface CreateCommentInput {
  body: Html;
  createdBy?: string;
}

/**
 * Messages the server broadcasts to connected clients after every
 * state-changing operation. For comments, exactly one of `taskId`/`subtaskId`
 * is set, identifying the owner of the comment.
 */
export type ServerMessage =
  | { type: "task.upserted"; task: TaskDetail }
  | { type: "task.deleted"; taskId: number }
  | { type: "subtask.upserted"; taskId: number; subtask: SubtaskDetail }
  | { type: "subtask.deleted"; taskId: number; subtaskId: number }
  | { type: "comment.added"; taskId?: number; subtaskId?: number; comment: Comment }
  | { type: "comment.deleted"; taskId?: number; subtaskId?: number; commentId: number };
