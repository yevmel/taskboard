import type { BunRequest } from "bun";
import * as db from "./db.ts";
import { sanitizeRichText } from "./sanitize.ts";
import { broadcast, clientIdFromRequest } from "./ws.ts";
import type {
  CreateCommentInput,
  CreateSubtaskInput,
  CreateTaskInput,
  Html,
  TaskStatus,
  UpdateSubtaskInput,
  UpdateTaskInput,
} from "../shared/types.ts";

/**
 * Every path served by the TaskBoard REST API.
 * Collection endpoints use a trailing slash; item endpoints do not.
 */
export type ApiRoutePath =
  | "/api/tasks/"
  | "/api/tasks/:taskId"
  | "/api/tasks/:taskId/comments/"
  | "/api/tasks/:taskId/comments/:commentId"
  | "/api/tasks/:taskId/subtasks/"
  | "/api/tasks/:taskId/subtasks/:subtaskId"
  | "/api/tasks/:taskId/subtasks/:subtaskId/comments/"
  | "/api/tasks/:taskId/subtasks/:subtaskId/comments/:commentId";

export const apiRoutes = {
  "/api/tasks/": {
    GET: handleListTasks,
    POST: handleCreateTask,
  },
  "/api/tasks/:taskId": {
    GET: handleGetTask,
    POST: handleUpdateTask,
    DELETE: handleDeleteTask,
  },
  "/api/tasks/:taskId/comments/": {
    GET: handleListTaskComments,
    POST: handleCreateTaskComment,
  },
  "/api/tasks/:taskId/comments/:commentId": {
    DELETE: handleDeleteTaskComment,
  },
  "/api/tasks/:taskId/subtasks/": {
    GET: handleListTaskSubtasks,
    POST: handleCreateSubtask,
  },
  "/api/tasks/:taskId/subtasks/:subtaskId": {
    GET: handleGetSubtask,
    POST: handleUpdateSubtask,
    DELETE: handleDeleteSubtask,
  },
  "/api/tasks/:taskId/subtasks/:subtaskId/comments/": {
    GET: handleListSubtaskComments,
    POST: handleCreateSubtaskComment,
  },
  "/api/tasks/:taskId/subtasks/:subtaskId/comments/:commentId": {
    DELETE: handleDeleteSubtaskComment,
  },
} satisfies Bun.Serve.Routes<undefined, ApiRoutePath>;

const INVALID_JSON = Symbol("invalid-json");

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function notFound(message: string): Response {
  return json({ error: message }, 404);
}

async function readJsonBody(request: Request): Promise<unknown | typeof INVALID_JSON> {
  try {
    return await request.json();
  } catch {
    return INVALID_JSON;
  }
}

/** Path ids must be positive integers. */
function parseId(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

const TASK_STATUSES: readonly TaskStatus[] = ["OPEN", "IN PROGRESS", "DONE"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

/** Rich text fields are HTML strings (sanitized before being persisted). */
function isHtmlString(value: unknown): value is Html {
  return typeof value === "string";
}

function parseCreateTaskInput(body: unknown): ParseResult<CreateTaskInput> {
  if (!isRecord(body)) return fail("Request body must be a JSON object");
  if (!isNonEmptyString(body.title)) return fail("'title' is required and must be a non-empty string");
  if (body.status !== undefined)
    return fail("'status' cannot be set when creating a task; new tasks are always created as OPEN");
  if (body.description !== undefined && !isHtmlString(body.description))
    return fail("'description' must be a string of HTML");
  if (body.createdBy !== undefined && typeof body.createdBy !== "string")
    return fail("'createdBy' must be a string");

  return {
    ok: true,
    value: {
      title: body.title,
      ...(body.description !== undefined ? { description: sanitizeRichText(body.description) } : {}),
      ...(body.createdBy !== undefined ? { createdBy: body.createdBy } : {}),
    },
  };
}

function parseUpdateTaskInput(body: unknown): ParseResult<UpdateTaskInput> {
  if (!isRecord(body)) return fail("Request body must be a JSON object");

  const value: UpdateTaskInput = {};
  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title)) return fail("'title' must be a non-empty string");
    value.title = body.title;
  }
  if (body.description !== undefined) {
    if (!isHtmlString(body.description)) return fail("'description' must be a string of HTML");
    value.description = sanitizeRichText(body.description);
  }
  if (body.status !== undefined) {
    if (!isTaskStatus(body.status)) return fail("'status' must be one of: OPEN, IN PROGRESS, DONE");
    value.status = body.status;
  }
  if (body.createdBy !== undefined) {
    if (typeof body.createdBy !== "string") return fail("'createdBy' must be a string");
    value.createdBy = body.createdBy;
  }

  if (Object.keys(value).length === 0)
    return fail("At least one field to update must be provided (title, description, status, createdBy)");
  return { ok: true, value };
}

function parseCreateSubtaskInput(body: unknown): ParseResult<CreateSubtaskInput> {
  if (!isRecord(body)) return fail("Request body must be a JSON object");
  if (!isNonEmptyString(body.title)) return fail("'title' is required and must be a non-empty string");
  if (body.description !== undefined && !isHtmlString(body.description))
    return fail("'description' must be a string of HTML");
  if (body.createdBy !== undefined && typeof body.createdBy !== "string")
    return fail("'createdBy' must be a string");

  return {
    ok: true,
    value: {
      title: body.title,
      ...(body.description !== undefined ? { description: sanitizeRichText(body.description) } : {}),
      ...(body.createdBy !== undefined ? { createdBy: body.createdBy } : {}),
    },
  };
}

function parseUpdateSubtaskInput(body: unknown): ParseResult<UpdateSubtaskInput> {
  if (!isRecord(body)) return fail("Request body must be a JSON object");

  const value: UpdateSubtaskInput = {};
  if (body.title !== undefined) {
    if (!isNonEmptyString(body.title)) return fail("'title' must be a non-empty string");
    value.title = body.title;
  }
  if (body.description !== undefined) {
    if (!isHtmlString(body.description)) return fail("'description' must be a string of HTML");
    value.description = sanitizeRichText(body.description);
  }
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") return fail("'done' must be a boolean");
    value.done = body.done;
  }
  if (body.createdBy !== undefined) {
    if (typeof body.createdBy !== "string") return fail("'createdBy' must be a string");
    value.createdBy = body.createdBy;
  }

  if (Object.keys(value).length === 0)
    return fail("At least one field to update must be provided (title, description, done, createdBy)");
  return { ok: true, value };
}

function parseCreateCommentInput(body: unknown): ParseResult<CreateCommentInput> {
  if (!isRecord(body)) return fail("Request body must be a JSON object");
  if (!isHtmlString(body.body)) return fail("'body' is required and must be a string of HTML");
  if (body.createdBy !== undefined && typeof body.createdBy !== "string")
    return fail("'createdBy' must be a string");

  return {
    ok: true,
    value: {
      body: sanitizeRichText(body.body),
      ...(body.createdBy !== undefined ? { createdBy: body.createdBy } : {}),
    },
  };
}

// GET /api/tasks/
async function handleListTasks(): Promise<Response> {
  const tasks = await db.listTasks();
  return json(tasks);
}

// POST /api/tasks/
async function handleCreateTask(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (body === INVALID_JSON) return badRequest("Request body must be valid JSON");
  const parsed = parseCreateTaskInput(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const task = await db.createTask(parsed.value);
  broadcast({ type: "task.upserted", task }, clientIdFromRequest(request));
  return json(task, 201);
}

// GET /api/tasks/:taskId
async function handleGetTask(request: BunRequest<"/api/tasks/:taskId">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  if (taskId === null) return badRequest("'taskId' must be a positive integer");
  const task = await db.getTask(taskId);
  return task ? json(task) : notFound(`Task ${request.params.taskId} not found`);
}

// POST /api/tasks/:taskId
async function handleUpdateTask(request: BunRequest<"/api/tasks/:taskId">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  if (taskId === null) return badRequest("'taskId' must be a positive integer");
  const body = await readJsonBody(request);
  if (body === INVALID_JSON) return badRequest("Request body must be valid JSON");
  const parsed = parseUpdateTaskInput(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const task = await db.updateTask(taskId, parsed.value);
  if (!task) return notFound(`Task ${request.params.taskId} not found`);
  broadcast({ type: "task.upserted", task }, clientIdFromRequest(request));
  return json(task);
}

// DELETE /api/tasks/:taskId
async function handleDeleteTask(request: BunRequest<"/api/tasks/:taskId">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  if (taskId === null) return badRequest("'taskId' must be a positive integer");
  const deleted = await db.deleteTask(taskId);
  if (!deleted) return notFound(`Task ${request.params.taskId} not found`);
  broadcast({ type: "task.deleted", taskId }, clientIdFromRequest(request));
  return new Response(null, { status: 204 });
}

// GET /api/tasks/:taskId/comments/
async function handleListTaskComments(request: BunRequest<"/api/tasks/:taskId/comments/">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  if (taskId === null) return badRequest("'taskId' must be a positive integer");
  const comments = await db.listTaskComments(taskId);
  return comments ? json(comments) : notFound(`Task ${request.params.taskId} not found`);
}

// POST /api/tasks/:taskId/comments/
async function handleCreateTaskComment(request: BunRequest<"/api/tasks/:taskId/comments/">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  if (taskId === null) return badRequest("'taskId' must be a positive integer");
  const body = await readJsonBody(request);
  if (body === INVALID_JSON) return badRequest("Request body must be valid JSON");
  const parsed = parseCreateCommentInput(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const comment = await db.createTaskComment(taskId, parsed.value);
  if (!comment) return notFound(`Task ${request.params.taskId} not found`);
  broadcast({ type: "comment.added", taskId, comment }, clientIdFromRequest(request));
  return json(comment, 201);
}

// DELETE /api/tasks/:taskId/comments/:commentId
async function handleDeleteTaskComment(
  request: BunRequest<"/api/tasks/:taskId/comments/:commentId">,
): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  const commentId = parseId(request.params.commentId);
  if (taskId === null || commentId === null)
    return badRequest("'taskId' and 'commentId' must be positive integers");
  const deleted = await db.deleteTaskComment(taskId, commentId);
  if (!deleted)
    return notFound(`Comment ${request.params.commentId} not found for task ${request.params.taskId}`);
  broadcast({ type: "comment.deleted", taskId, commentId }, clientIdFromRequest(request));
  return new Response(null, { status: 204 });
}

// GET /api/tasks/:taskId/subtasks/
async function handleListTaskSubtasks(request: BunRequest<"/api/tasks/:taskId/subtasks/">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  if (taskId === null) return badRequest("'taskId' must be a positive integer");
  const subtasks = await db.listTaskSubtasks(taskId);
  return subtasks ? json(subtasks) : notFound(`Task ${request.params.taskId} not found`);
}

// POST /api/tasks/:taskId/subtasks/
async function handleCreateSubtask(request: BunRequest<"/api/tasks/:taskId/subtasks/">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  if (taskId === null) return badRequest("'taskId' must be a positive integer");
  const body = await readJsonBody(request);
  if (body === INVALID_JSON) return badRequest("Request body must be valid JSON");
  const parsed = parseCreateSubtaskInput(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const subtask = await db.createSubtask(taskId, parsed.value);
  if (!subtask) return notFound(`Task ${request.params.taskId} not found`);
  broadcast({ type: "subtask.upserted", taskId, subtask }, clientIdFromRequest(request));
  return json(subtask, 201);
}

// GET /api/tasks/:taskId/subtasks/:subtaskId
async function handleGetSubtask(request: BunRequest<"/api/tasks/:taskId/subtasks/:subtaskId">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  const subtaskId = parseId(request.params.subtaskId);
  if (taskId === null || subtaskId === null)
    return badRequest("'taskId' and 'subtaskId' must be positive integers");
  const subtask = await db.getSubtask(taskId, subtaskId);
  return subtask
    ? json(subtask)
    : notFound(`Subtask ${request.params.subtaskId} not found for task ${request.params.taskId}`);
}

// POST /api/tasks/:taskId/subtasks/:subtaskId
async function handleUpdateSubtask(request: BunRequest<"/api/tasks/:taskId/subtasks/:subtaskId">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  const subtaskId = parseId(request.params.subtaskId);
  if (taskId === null || subtaskId === null)
    return badRequest("'taskId' and 'subtaskId' must be positive integers");
  const body = await readJsonBody(request);
  if (body === INVALID_JSON) return badRequest("Request body must be valid JSON");
  const parsed = parseUpdateSubtaskInput(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const subtask = await db.updateSubtask(taskId, subtaskId, parsed.value);
  if (!subtask)
    return notFound(`Subtask ${request.params.subtaskId} not found for task ${request.params.taskId}`);
  broadcast({ type: "subtask.upserted", taskId, subtask }, clientIdFromRequest(request));
  return json(subtask);
}

// DELETE /api/tasks/:taskId/subtasks/:subtaskId
async function handleDeleteSubtask(request: BunRequest<"/api/tasks/:taskId/subtasks/:subtaskId">): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  const subtaskId = parseId(request.params.subtaskId);
  if (taskId === null || subtaskId === null)
    return badRequest("'taskId' and 'subtaskId' must be positive integers");
  const deleted = await db.deleteSubtask(taskId, subtaskId);
  if (!deleted)
    return notFound(`Subtask ${request.params.subtaskId} not found for task ${request.params.taskId}`);
  broadcast({ type: "subtask.deleted", taskId, subtaskId }, clientIdFromRequest(request));
  return new Response(null, { status: 204 });
}

// GET /api/tasks/:taskId/subtasks/:subtaskId/comments/
async function handleListSubtaskComments(
  request: BunRequest<"/api/tasks/:taskId/subtasks/:subtaskId/comments/">,
): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  const subtaskId = parseId(request.params.subtaskId);
  if (taskId === null || subtaskId === null)
    return badRequest("'taskId' and 'subtaskId' must be positive integers");
  const comments = await db.listSubtaskComments(taskId, subtaskId);
  return comments
    ? json(comments)
    : notFound(`Subtask ${request.params.subtaskId} not found for task ${request.params.taskId}`);
}

// POST /api/tasks/:taskId/subtasks/:subtaskId/comments/
async function handleCreateSubtaskComment(
  request: BunRequest<"/api/tasks/:taskId/subtasks/:subtaskId/comments/">,
): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  const subtaskId = parseId(request.params.subtaskId);
  if (taskId === null || subtaskId === null)
    return badRequest("'taskId' and 'subtaskId' must be positive integers");
  const body = await readJsonBody(request);
  if (body === INVALID_JSON) return badRequest("Request body must be valid JSON");
  const parsed = parseCreateCommentInput(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const comment = await db.createSubtaskComment(taskId, subtaskId, parsed.value);
  if (!comment)
    return notFound(`Subtask ${request.params.subtaskId} not found for task ${request.params.taskId}`);
  broadcast({ type: "comment.added", subtaskId, comment }, clientIdFromRequest(request));
  return json(comment, 201);
}

// DELETE /api/tasks/:taskId/subtasks/:subtaskId/comments/:commentId
async function handleDeleteSubtaskComment(
  request: BunRequest<"/api/tasks/:taskId/subtasks/:subtaskId/comments/:commentId">,
): Promise<Response> {
  const taskId = parseId(request.params.taskId);
  const subtaskId = parseId(request.params.subtaskId);
  const commentId = parseId(request.params.commentId);
  if (taskId === null || subtaskId === null || commentId === null)
    return badRequest("'taskId', 'subtaskId' and 'commentId' must be positive integers");
  const deleted = await db.deleteSubtaskComment(taskId, subtaskId, commentId);
  if (!deleted)
    return notFound(`Comment ${request.params.commentId} not found for subtask ${request.params.subtaskId}`);
  broadcast({ type: "comment.deleted", subtaskId, commentId }, clientIdFromRequest(request));
  return new Response(null, { status: 204 });
}
