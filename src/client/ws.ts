import { dispatch, getState } from "./store.ts";
import { getClientId } from "./client-id.ts";
import { loadTasks, resyncOpenTaskDetail } from "./actions.ts";
import type { ServerMessage } from "../shared/types.ts";

/**
 * WebSocket connection to the server's /ws endpoint.
 *
 * - The client identifies itself with a stable clientId so the server skips
 *   broadcasting its own changes back to it.
 * - Incoming broadcasts are translated into the existing store actions, so the
 *   board and open drawers update without refetching.
 * - The connection reconnects automatically with a backoff; on (re)connect the
 *   task list and the open task detail are refetched to resync anything missed
 *   while disconnected.
 */

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let backoffMs = 1000;

const MAX_BACKOFF_MS = 10000;
const INITIAL_BACKOFF_MS = 1000;

function wsUrl(): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws?clientId=${encodeURIComponent(getClientId())}`;
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectWs();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
}

/** Translate a server broadcast into the corresponding store actions. */
function applyServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case "task.upserted": {
      // TASK_UPDATED only patches existing entries, so a task we don't know yet
      // must be added (TASK_CREATED) instead.
      const known = getState().tasks?.some((task) => task.id === message.task.id) ?? false;
      if (known) {
        dispatch({ type: "TASK_UPDATED", task: message.task });
      } else {
        dispatch({ type: "TASK_CREATED", task: message.task });
      }
      break;
    }

    case "task.deleted":
      dispatch({ type: "TASK_REMOVED", taskId: message.taskId });
      break;

    case "subtask.upserted": {
      // Check both the cached drawer detail and the board list, so an update to
      // a subtask we already know is not mistaken for a new one.
      const detail = getState().details[message.taskId];
      const listTask = getState().tasks?.find((task) => task.id === message.taskId);
      const known =
        (detail?.subtasks.some((subtask) => subtask.id === message.subtask.id) ?? false) ||
        (listTask?.subtasks.some((subtask) => subtask.id === message.subtask.id) ?? false);
      if (known) {
        dispatch({ type: "SUBTASK_UPDATED", taskId: message.taskId, subtask: message.subtask });
      } else {
        dispatch({ type: "SUBTASK_ADDED", taskId: message.taskId, subtask: message.subtask });
      }
      break;
    }

    case "subtask.deleted":
      dispatch({ type: "SUBTASK_REMOVED", taskId: message.taskId, subtaskId: message.subtaskId });
      break;

    case "comment.added":
      if (message.subtaskId !== undefined) {
        dispatch({ type: "SUBTASK_COMMENT_ADDED", subtaskId: message.subtaskId, comment: message.comment });
      } else if (message.taskId !== undefined) {
        dispatch({ type: "COMMENT_ADDED", taskId: message.taskId, comment: message.comment });
      }
      break;

    case "comment.deleted":
      if (message.subtaskId !== undefined) {
        dispatch({
          type: "SUBTASK_COMMENT_REMOVED",
          subtaskId: message.subtaskId,
          commentId: message.commentId,
        });
      } else if (message.taskId !== undefined) {
        dispatch({ type: "COMMENT_REMOVED", taskId: message.taskId, commentId: message.commentId });
      }
      break;
  }
}

/** Open the WebSocket connection (and keep reconnecting on close). */
export function connectWs(): void {
  try {
    socket = new WebSocket(wsUrl());
  } catch {
    scheduleReconnect();
    return;
  }

  socket.addEventListener("open", () => {
    backoffMs = INITIAL_BACKOFF_MS;
    // Resync in case anything changed while we were disconnected.
    void loadTasks();
    void resyncOpenTaskDetail();
  });

  socket.addEventListener("message", (event: MessageEvent) => {
    try {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      applyServerMessage(message);
    } catch {
      // Ignore malformed messages.
    }
  });

  socket.addEventListener("close", () => {
    socket = null;
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    socket?.close();
  });
}
