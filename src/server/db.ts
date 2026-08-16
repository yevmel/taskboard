import postgres from "postgres";
import type {
  Comment,
  CreateCommentInput,
  CreateSubtaskInput,
  CreateTaskInput,
  Html,
  SubtaskDetail,
  SubtaskSummary,
  TaskDetail,
  TaskSummary,
  TaskStatus,
  UpdateSubtaskInput,
  UpdateTaskInput,
} from "../shared/types.ts";

/**
 * PostgreSQL client.
 * Uses DATABASE_URL when set, otherwise falls back to the standard PG* env vars
 * (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD).
 */
const connectionString = process.env.DATABASE_URL;
export const sql = connectionString ? postgres(connectionString) : postgres();

/** Empty rich text (HTML), used as the default for descriptions. */
export const EMPTY_HTML: Html = "";

/**
 * Format a timestamp as "YYYY-MM-DD HH:mm:ss" in UTC.
 */
export function formatTimestamp(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ` +
    `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`
  );
}

/** "created by" defaults to "unknown" when no username is provided. */
function defaultCreatedBy(createdBy: string | undefined): string {
  const trimmed = createdBy?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "unknown";
}

interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  created_at: Date;
  created_by: string;
}

interface SubtaskRow {
  id: number;
  task_id: number;
  title: string;
  description: string;
  done: boolean;
  created_at: Date;
  created_by: string;
}

interface SubtaskSummaryRow {
  id: number;
  task_id: number;
  title: string;
  done: boolean;
}

interface CommentRow {
  id: number;
  body: string;
  created_at: Date;
  created_by: string;
  /** Set when the comment belongs to a subtask. */
  subtask_id?: number | null;
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    body: row.body,
    createdAt: formatTimestamp(row.created_at),
    createdBy: row.created_by,
  };
}

function toSubtaskDetail(row: SubtaskRow, comments: Comment[]): SubtaskDetail {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    done: row.done,
    comments,
    createdAt: formatTimestamp(row.created_at),
    createdBy: row.created_by,
  };
}

function toTaskSummary(row: TaskRow, subtasks: SubtaskSummary[]): TaskSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    subtasks,
    createdAt: formatTimestamp(row.created_at),
    createdBy: row.created_by,
  };
}

function toTaskDetail(row: TaskRow, subtasks: SubtaskDetail[], comments: Comment[]): TaskDetail {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    subtasks,
    comments,
    createdAt: formatTimestamp(row.created_at),
    createdBy: row.created_by,
  };
}

export async function listTasks(): Promise<TaskSummary[]> {
  const tasks = await sql<TaskRow[]>`
    SELECT id, title, description, status, created_at, created_by
    FROM tasks
    ORDER BY created_at DESC 
  `;

  if (tasks.length === 0) return [];

  const taskIds = tasks.map((task) => task.id);
  const subtaskRows = await sql<SubtaskSummaryRow[]>`
    SELECT id, task_id, title, done
    FROM subtasks
    WHERE task_id = ANY(${taskIds})
    ORDER BY created_at ASC
  `;

  const subtasksByTask = new Map<number, SubtaskSummary[]>();
  for (const row of subtaskRows) {
    const list = subtasksByTask.get(row.task_id) ?? [];
    list.push({ id: row.id, title: row.title, done: row.done });
    subtasksByTask.set(row.task_id, list);
  }

  return tasks.map((task) => toTaskSummary(task, subtasksByTask.get(task.id) ?? []));
}

export async function getTask(taskId: number): Promise<TaskDetail | null> {
  const [task] = await sql<TaskRow[]>`
    SELECT id, title, description, status, created_at, created_by
    FROM tasks
    WHERE id = ${taskId}
  `;
  if (!task) return null;

  const [subtaskRows, taskCommentRows] = await Promise.all([
    sql<SubtaskRow[]>`
      SELECT id, task_id, title, description, done, created_at, created_by
      FROM subtasks
      WHERE task_id = ${taskId}
      ORDER BY created_at ASC
    `,
    sql<CommentRow[]>`
      SELECT id, body, created_at, created_by
      FROM comments
      WHERE task_id = ${taskId}
      ORDER BY created_at ASC
    `,
  ]);

  let subtaskCommentRows: CommentRow[] = [];
  if (subtaskRows.length > 0) {
    subtaskCommentRows = await sql<CommentRow[]>`
      SELECT id, body, created_at, created_by, subtask_id
      FROM comments
      WHERE subtask_id = ANY(${subtaskRows.map((subtask) => subtask.id)})
      ORDER BY created_at ASC
    `;
  }

  const commentsBySubtask = new Map<number, Comment[]>();
  for (const row of subtaskCommentRows) {
    const subtaskId = row.subtask_id ?? -1;
    const list = commentsBySubtask.get(subtaskId) ?? [];
    list.push(toComment(row));
    commentsBySubtask.set(subtaskId, list);
  }

  const subtasks = subtaskRows.map((row) => toSubtaskDetail(row, commentsBySubtask.get(row.id) ?? []));
  return toTaskDetail(task, subtasks, taskCommentRows.map(toComment));
}

export async function createTask(input: CreateTaskInput): Promise<TaskDetail> {
  // New tasks are always created with status OPEN; the status cannot be set
  // by the client (see parseCreateTaskInput in api.ts).
  const [row] = await sql<TaskRow[]>`
    INSERT INTO tasks (title, description, status, created_by)
    VALUES (
      ${input.title},
      ${input.description ?? EMPTY_HTML},
      'OPEN',
      ${defaultCreatedBy(input.createdBy)}
    )
    RETURNING id, title, description, status, created_at, created_by
  `;
  return toTaskDetail(row!, [], []);
}

export async function deleteTask(taskId: number): Promise<boolean> {
  // Comments and subtasks (and their comments) are removed via ON DELETE CASCADE.
  const result = await sql`
    DELETE FROM tasks WHERE id = ${taskId}
  `;
  return result.count > 0;
}

export async function updateTask(taskId: number, input: UpdateTaskInput): Promise<TaskDetail | null> {
  const [existing] = await sql<{ id: number }[]>`SELECT id FROM tasks WHERE id = ${taskId}`;
  if (!existing) return null;

  if (input.title !== undefined) {
    await sql`UPDATE tasks SET title = ${input.title} WHERE id = ${taskId}`;
  }
  if (input.description !== undefined) {
    await sql`UPDATE tasks SET description = ${input.description} WHERE id = ${taskId}`;
  }
  if (input.status !== undefined) {
    await sql`UPDATE tasks SET status = ${input.status} WHERE id = ${taskId}`;
  }
  if (input.createdBy !== undefined) {
    await sql`UPDATE tasks SET created_by = ${defaultCreatedBy(input.createdBy)} WHERE id = ${taskId}`;
  }

  return getTask(taskId);
}

export async function listTaskComments(taskId: number): Promise<Comment[] | null> {
  const [task] = await sql<{ id: number }[]>`SELECT id FROM tasks WHERE id = ${taskId}`;
  if (!task) return null;

  const rows = await sql<CommentRow[]>`
    SELECT id, body, created_at, created_by
    FROM comments
    WHERE task_id = ${taskId}
    ORDER BY created_at ASC
  `;
  return rows.map(toComment);
}

export async function createTaskComment(taskId: number, input: CreateCommentInput): Promise<Comment | null> {
  const [task] = await sql<{ id: number }[]>`SELECT id FROM tasks WHERE id = ${taskId}`;
  if (!task) return null;

  const [row] = await sql<CommentRow[]>`
    INSERT INTO comments (task_id, body, created_by)
    VALUES (${taskId}, ${input.body}, ${defaultCreatedBy(input.createdBy)})
    RETURNING id, body, created_at, created_by
  `;
  return toComment(row!);
}

export async function deleteTaskComment(taskId: number, commentId: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM comments
    WHERE id = ${commentId} AND task_id = ${taskId}
  `;
  return result.count > 0;
}

export async function listTaskSubtasks(taskId: number): Promise<SubtaskDetail[] | null> {
  const [task] = await sql<{ id: number }[]>`SELECT id FROM tasks WHERE id = ${taskId}`;
  if (!task) return null;

  const subtaskRows = await sql<SubtaskRow[]>`
    SELECT id, task_id, title, description, done, created_at, created_by
    FROM subtasks
    WHERE task_id = ${taskId}
    ORDER BY created_at ASC 
  `;

  let commentRows: CommentRow[] = [];
  if (subtaskRows.length > 0) {
    commentRows = await sql<CommentRow[]>`
      SELECT id, body, created_at, created_by, subtask_id
      FROM comments
      WHERE subtask_id = ANY(${subtaskRows.map((subtask) => subtask.id)})
      ORDER BY created_at ASC
    `;
  }

  const commentsBySubtask = new Map<number, Comment[]>();
  for (const row of commentRows) {
    const subtaskId = row.subtask_id ?? -1;
    const list = commentsBySubtask.get(subtaskId) ?? [];
    list.push(toComment(row));
    commentsBySubtask.set(subtaskId, list);
  }

  return subtaskRows.map((row) => toSubtaskDetail(row, commentsBySubtask.get(row.id) ?? []));
}

export async function getSubtask(taskId: number, subtaskId: number): Promise<SubtaskDetail | null> {
  const [subtask] = await sql<SubtaskRow[]>`
    SELECT id, task_id, title, description, done, created_at, created_by
    FROM subtasks
    WHERE id = ${subtaskId} AND task_id = ${taskId}
  `;
  if (!subtask) return null;

  const commentRows = await sql<CommentRow[]>`
    SELECT id, body, created_at, created_by
    FROM comments
    WHERE subtask_id = ${subtaskId}
    ORDER BY created_at ASC
  `;

  return toSubtaskDetail(subtask, commentRows.map(toComment));
}

export async function createSubtask(taskId: number, input: CreateSubtaskInput): Promise<SubtaskDetail | null> {
  const [task] = await sql<{ id: number }[]>`SELECT id FROM tasks WHERE id = ${taskId}`;
  if (!task) return null;

  const [row] = await sql<SubtaskRow[]>`
    INSERT INTO subtasks (task_id, title, description, created_by)
    VALUES (${taskId}, ${input.title}, ${input.description ?? EMPTY_HTML}, ${defaultCreatedBy(input.createdBy)})
    RETURNING id, task_id, title, description, done, created_at, created_by
  `;
  return toSubtaskDetail(row!, []);
}

export async function updateSubtask(
  taskId: number,
  subtaskId: number,
  input: UpdateSubtaskInput,
): Promise<SubtaskDetail | null> {
  const [existing] = await sql<{ id: number }[]>`
    SELECT id FROM subtasks WHERE id = ${subtaskId} AND task_id = ${taskId}
  `;
  if (!existing) return null;

  if (input.title !== undefined) {
    await sql`UPDATE subtasks SET title = ${input.title} WHERE id = ${subtaskId} AND task_id = ${taskId}`;
  }
  if (input.description !== undefined) {
    await sql`UPDATE subtasks SET description = ${input.description} WHERE id = ${subtaskId} AND task_id = ${taskId}`;
  }
  if (input.done !== undefined) {
    await sql`UPDATE subtasks SET done = ${input.done} WHERE id = ${subtaskId} AND task_id = ${taskId}`;
  }
  if (input.createdBy !== undefined) {
    await sql`UPDATE subtasks SET created_by = ${defaultCreatedBy(input.createdBy)} WHERE id = ${subtaskId} AND task_id = ${taskId}`;
  }

  return getSubtask(taskId, subtaskId);
}

export async function deleteSubtask(taskId: number, subtaskId: number): Promise<boolean> {
  const result = await sql`
    DELETE FROM subtasks
    WHERE id = ${subtaskId} AND task_id = ${taskId}
  `;
  return result.count > 0;
}

export async function listSubtaskComments(taskId: number, subtaskId: number): Promise<Comment[] | null> {
  const [subtask] = await sql<{ id: number }[]>`
    SELECT id FROM subtasks WHERE id = ${subtaskId} AND task_id = ${taskId}
  `;
  if (!subtask) return null;

  const rows = await sql<CommentRow[]>`
    SELECT id, body, created_at, created_by
    FROM comments
    WHERE subtask_id = ${subtaskId}
    ORDER BY created_at ASC
  `;
  return rows.map(toComment);
}

export async function createSubtaskComment(
  taskId: number,
  subtaskId: number,
  input: CreateCommentInput,
): Promise<Comment | null> {
  const [subtask] = await sql<{ id: number }[]>`
    SELECT id FROM subtasks WHERE id = ${subtaskId} AND task_id = ${taskId}
  `;
  if (!subtask) return null;

  const [row] = await sql<CommentRow[]>`
    INSERT INTO comments (subtask_id, body, created_by)
    VALUES (${subtaskId}, ${input.body}, ${defaultCreatedBy(input.createdBy)})
    RETURNING id, body, created_at, created_by
  `;
  return toComment(row!);
}

export async function deleteSubtaskComment(
  taskId: number,
  subtaskId: number,
  commentId: number,
): Promise<boolean> {
  // The comment is only deleted if it belongs to a subtask of the given task.
  const result = await sql`
    DELETE FROM comments
    WHERE id = ${commentId}
      AND subtask_id = ${subtaskId}
      AND subtask_id IN (SELECT id FROM subtasks WHERE id = ${subtaskId} AND task_id = ${taskId})
  `;
  return result.count > 0;
}
