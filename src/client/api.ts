import type {
  Comment,
  CreateSubtaskInput,
  CreateTaskInput,
  Html,
  SubtaskDetail,
  TaskDetail,
  TaskSummary,
  UpdateSubtaskInput,
  UpdateTaskInput,
} from "../shared/types.ts";
import { getClientId } from "./client-id.ts";

/**
 * REST client for the TaskBoard API.
 *
 * The UI consumes exactly the same endpoints that third-party clients use
 * (see openapi.yaml). Every request carries an `X-Client-Id` header so the
 * server can exclude the originating client from WebSocket broadcasts of its
 * own changes.
 */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", "X-Client-Id": getClientId() },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error.length > 0) message = body.error;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  listTasks(): Promise<TaskSummary[]> {
    return request("/api/tasks/");
  },

  createTask(input: CreateTaskInput): Promise<TaskDetail> {
    return request("/api/tasks/", { method: "POST", body: JSON.stringify(input) });
  },

  getTask(taskId: number): Promise<TaskDetail> {
    return request(`/api/tasks/${taskId}`);
  },

  updateTask(taskId: number, patch: UpdateTaskInput): Promise<TaskDetail> {
    return request(`/api/tasks/${taskId}`, { method: "POST", body: JSON.stringify(patch) });
  },

  deleteTask(taskId: number): Promise<void> {
    return request(`/api/tasks/${taskId}`, { method: "DELETE" });
  },

  getSubtask(taskId: number, subtaskId: number): Promise<SubtaskDetail> {
    return request(`/api/tasks/${taskId}/subtasks/${subtaskId}`);
  },

  addSubtask(taskId: number, input: CreateSubtaskInput): Promise<SubtaskDetail> {
    return request(`/api/tasks/${taskId}/subtasks/`, { method: "POST", body: JSON.stringify(input) });
  },

  updateSubtask(taskId: number, subtaskId: number, patch: UpdateSubtaskInput): Promise<SubtaskDetail> {
    return request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "POST",
      body: JSON.stringify(patch),
    });
  },

  deleteSubtask(taskId: number, subtaskId: number): Promise<void> {
    return request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
  },

  addComment(taskId: number, body: Html): Promise<Comment> {
    return request(`/api/tasks/${taskId}/comments/`, { method: "POST", body: JSON.stringify({ body }) });
  },

  deleteTaskComment(taskId: number, commentId: number): Promise<void> {
    return request(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
  },

  addSubtaskComment(taskId: number, subtaskId: number, body: Html): Promise<Comment> {
    return request(`/api/tasks/${taskId}/subtasks/${subtaskId}/comments/`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  },

  deleteSubtaskComment(taskId: number, subtaskId: number, commentId: number): Promise<void> {
    return request(`/api/tasks/${taskId}/subtasks/${subtaskId}/comments/${commentId}`, {
      method: "DELETE",
    });
  },
};
