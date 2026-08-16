import path from "node:path";
import { apiRoutes } from "./api.ts";
import { sql } from "./db.ts";
import { handleWsUpgrade, websocketHandlers } from "./ws.ts";

const PORT = Number(process.env.PORT ?? 3000);
const PROJECT_ROOT = path.resolve(import.meta.dir, "../..");
const DIST_DIR = path.join(PROJECT_ROOT, "dist");

/** Apply schema.sql (idempotent) so the server works against a fresh database. */
async function applySchema(): Promise<void> {
  const schemaPath = path.join(PROJECT_ROOT, "schema.sql");
  const schema = await Bun.file(schemaPath).text();
  await sql.unsafe(schema);
}

/** Serve a file from the built client bundle (dist/). */
async function serveStatic(pathname: string): Promise<Response> {
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = Bun.file(path.join(DIST_DIR, relative));
  if (await file.exists()) return new Response(file);

  // SPA fallback: client routes all render from index.html.
  const indexFile = Bun.file(path.join(DIST_DIR, "index.html"));
  if (await indexFile.exists()) return new Response(indexFile);

  return new Response("Not Found", { status: 404 });
}

try {
  await applySchema();
} catch (error) {
  console.error("Failed to apply database schema (schema.sql). Is the database running?", error);
  process.exit(1);
}

const server = Bun.serve({
  port: PORT,
  routes: {
    ...apiRoutes,
    "/ws": {
      GET: handleWsUpgrade,
    },
  },
  websocket: websocketHandlers,
  // Fallback for anything not matched by the API routes: the built client.
  fetch(request) {
    return serveStatic(new URL(request.url).pathname);
  },
  error(error) {
    console.error("Unhandled server error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  },
});

console.log(`TaskBoard server listening on http://localhost:${server.port}`);
