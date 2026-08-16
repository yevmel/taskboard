const STORAGE_KEY = "taskboard-client-id";

/**
 * A stable, per-browser identifier for this client.
 *
 * Used as `X-Client-Id` on every REST request and as the `clientId` query
 * parameter of the WebSocket connection, so the server can skip broadcasting a
 * client's own changes back to it.
 */
export function getClientId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // localStorage unavailable; fall through to a fresh id.
  }
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Ignore storage failures (e.g. privacy mode).
  }
  return id;
}
