import type { ServerWebSocket } from "bun";

/** Per-connection data: the client id this connection belongs to. */
export interface WsData {
  clientId: string;
}

/** All currently connected clients. */
const clients = new Set<ServerWebSocket<WsData>>();
const clientIdBySocket = new Map<ServerWebSocket<WsData>, string>();

/**
 * Send a JSON message to every connected client except the one that
 * originated the change (identified by `exceptClientId`, read from the
 * `X-Client-Id` header of the REST request).
 */
export function broadcast(message: unknown, exceptClientId?: string): void {
  const payload = JSON.stringify(message);
  for (const ws of clients) {
    if (exceptClientId !== undefined && clientIdBySocket.get(ws) === exceptClientId) continue;
    try {
      ws.send(payload);
    } catch {
      // Socket is gone; it is removed from the registry on close.
    }
  }
}

/** Read the client id from the `X-Client-Id` header, if present. */
export function clientIdFromRequest(request: Request): string | undefined {
  const value = request.headers.get("x-client-id");
  return value && value.length > 0 ? value : undefined;
}

/** GET /ws — upgrade the request to a WebSocket, tagging it with its client id. */
export function handleWsUpgrade(request: Request, server: Bun.Server<WsData>): Response | undefined {
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) {
    return Response.json({ error: "Missing clientId query parameter" }, { status: 400 });
  }
  const upgraded = server.upgrade(request, { data: { clientId } });
  return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
}

/** WebSocket lifecycle handlers for Bun.serve. */
export const websocketHandlers = {
  open(ws: ServerWebSocket<WsData>): void {
    console.log("client connected: ", ws.data.clientId)

    clients.add(ws);
    clientIdBySocket.set(ws, ws.data.clientId);
  },

  close(ws: ServerWebSocket<WsData>): void {
    console.log("client disconnected: ", ws.data.clientId)

    clients.delete(ws);
    clientIdBySocket.delete(ws);
  },
  message(_ws: ServerWebSocket<WsData>, _message: string | Buffer): void {
    // Clients currently only listen for broadcasts; no inbound protocol.
  },
};
