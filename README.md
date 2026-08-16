# TaskBoard 2.0

A dense, enterprise-style three-column task board (Kanban) with tasks, subtasks,
comments, rich-text editing, dark mode, and real-time multi-client sync.

> This file was regenerated as a record of the project's current state. It
> documents the architecture, setup, API, data model, and notable implementation
> details found while reviewing the codebase.

## Tech stack

| Layer    | Technology                                                                                 |
| -------- | ------------------------------------------------------------------------------------------ |
| Client   | TypeScript + [lit-html](https://lit.dev/docs/libraries/lit-html/) + [Quill](https://quilljs.com/) |
| Server   | [Bun](https://bun.sh/) HTTP server (`Bun.serve`) + WebSockets                              |
| Database | PostgreSQL (via the [`postgres`](https://github.com/porsager/postgres) driver)             |
| Docs     | [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0)                                               |

## Project layout

```
src/
  client/                 # Browser app (bundled into dist/)
    index.ts              # Entry point: bootstrap store, theme, WS
    index.html            # HTML shell (copied to dist/ on build)
    style.css             # All styling, incl. [data-theme="dark"] overrides
    store.ts              # Redux-style store (dispatch → reducer → rAF render)
    state.ts              # AppState shape + reducer
    actions.ts            # Async action creators (API + dispatch)
    api.ts                # REST client (adds X-Client-Id header)
    ws.ts                 # WebSocket client (reconnect w/ backoff, resync)
    client-id.ts          # Stable per-browser id (localStorage)
    theme.ts              # Theme resolve/apply/persist
    components/
      app.ts              # Root view (header + board + drawer + modal)
      board.ts            # Three-column board
      task-card.ts        # Task card with excerpt expand/collapse
      drawer.ts           # Task/subtask detail drawer
      task-form.ts        # New-task modal
      quill.ts            # Quill editor as a lit-html directive
  server/
    index.ts              # Bun.serve entry, static serving, schema bootstrap
    api.ts                # REST route table + handlers + validation
    db.ts                 # Postgres queries + row→API shape mapping
    ws.ts                 # WebSocket broadcast registry
    sanitize.ts           # sanitize-html policy for rich text
  shared/
    types.ts              # Wire types shared by client & server
schema.sql                # Idempotent DDL (applied automatically at startup)
openapi.yaml              # OpenAPI 3.0 API spec
docker-compose.yml        # Postgres container (port 25432)
```

## Data model

- **Task** — `title`, `description` (sanitized HTML), `status`
  (`OPEN` / `IN PROGRESS` / `DONE`), `created_at`, `created_by`.
- **Subtask** — `title`, `description` (sanitized HTML), `done` flag,
  `created_at`, `created_by`, FK → task (`ON DELETE CASCADE`).
- **Comment** — `body` (sanitized HTML), `created_at`, `created_by`; belongs to
  exactly one owner via nullable `task_id` / `subtask_id` FKs
  (`ON DELETE CASCADE`), enforced by `comments_owner_check`.

Notes found during review:

- Rich text was migrated from JSONB Deltas to sanitized **HTML** (see the
  `ALTER TABLE ... TYPE TEXT USING ...::text` statements in `schema.sql`, which
  are no-ops on fresh DBs).
- `description`/`body` default to `''` (empty string) when not provided.
- `created_by` defaults to `"unknown"`.

## API overview

The UI consumes the same REST API documented in [`openapi.yaml`](openapi.yaml).
Conventions: collection endpoints use a trailing slash, item endpoints do not;
timestamps are UTC `YYYY-MM-DD HH:mm:ss` strings.

| Method | Path                                          | Description                |
| ------ | --------------------------------------------- | -------------------------- |
| GET    | `/api/tasks/`                                 | List tasks (+ summaries)   |
| POST   | `/api/tasks/`                                 | Create task (always OPEN)  |
| GET    | `/api/tasks/{id}`                             | Task detail + comments     |
| POST   | `/api/tasks/{id}`                             | Update task                |
| DELETE | `/api/tasks/{id}`                             | Delete task (cascades)     |
| GET/POST | `/api/tasks/{id}/comments/`                 | List/create task comments  |
| DELETE | `/api/tasks/{id}/comments/{commentId}`        | Delete task comment        |
| GET/POST | `/api/tasks/{id}/subtasks/`                 | List/create subtasks       |
| GET/POST/DELETE | `/api/tasks/{id}/subtasks/{subtaskId}` | Get/update/delete subtask  |
| GET/POST | `/api/tasks/{id}/subtasks/{subtaskId}/comments/` | List/create subtask comments |
| DELETE | `/api/tasks/{id}/subtasks/{subtaskId}/comments/{commentId}` | Delete subtask comment |

> **Quirk:** updates use `POST` on the item endpoint (not `PATCH`), and item
> routes are matched via Bun's route table (`"/api/tasks/:taskId"`).

## WebSocket real-time sync

- `GET /ws?clientId=...` upgrades to a WebSocket; clients currently only listen.
- Every REST request carries an `X-Client-Id` header. After each state-changing
  operation the server `broadcast()`s a message to all connected sockets
  **except** the originating client.
- Broadcast types (see `shared/types.ts`): `task.upserted`, `task.deleted`,
  `subtask.upserted`, `subtask.deleted`, `comment.added`, `comment.deleted`.
- The client translates broadcasts into existing store actions and reconnects
  automatically with exponential backoff (1s → 10s), refetching the task list
  and open task detail on reconnect.

## Client architecture

- **State** is a single global `AppState` (in `state.ts`) — never mutated
  directly. All changes go through `dispatch(action)` → `reducer`.
- **Store** (`store.ts`) schedules re-renders on `requestAnimationFrame`;
  components never call `render` directly. Theme side effects are applied and
  persisted in `dispatch` when the theme changes.
- **Components** are pure functions returning `TemplateResult`s.
- **Rich text** is edited with Quill, wrapped in a custom lit-html directive
  (`quill.ts`) that keeps a single editor instance alive across re-renders.
  Editor instances are tracked by key (`desc-<id>`, `comment-<id>-<n>`, …).
- **Theme** resolution order: localStorage → OS `prefers-color-scheme` → light.

## Server architecture

- `Bun.serve` with a `routes` table for the API and `/ws`, plus a `fetch`
  fallback that serves `dist/` (SPA fallback to `index.html`).
- `schema.sql` is applied automatically at startup (idempotent); startup fails
  with a clear error if the DB is unreachable.
- Rich-text inputs are validated and sanitized server-side via `sanitize-html`
  with an allowlist tuned to Quill output (see `src/server/sanitize.ts`).

## Prerequisites

- [Bun](https://bun.sh/) ≥ 1.x
- PostgreSQL (e.g. via Docker)

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Start PostgreSQL (Docker) — binds port 25432
docker compose up -d

# 3. (Optional) initialize the schema without starting the server
bun run db:init

# 4. Build the client bundle (emits dist/index.js + dist/index.css)
bun run build

# 5. Start the server (serves both UI and API)
bun run start
```

Open http://localhost:3000.

> The server runs `schema.sql` automatically at startup, so `db:init` is only
> needed to initialize the schema without starting the server.

## Configuration (environment variables)

| Variable       | Default                                   | Description                |
| -------------- | ----------------------------------------- | -------------------------- |
| `DATABASE_URL` | —                                         | Postgres connection string |
| `PGHOST`       | `localhost`                               | Fallback host              |
| `PGPORT`       | `25432`                                   | Fallback port              |
| `PGDATABASE`   | `taskboard`                               | Fallback database          |
| `PGUSER`       | `postgres`                                | Fallback user              |
| `PGPASSWORD`   | `postgres`                                | Fallback password          |
| `PORT`         | `3000`                                    | HTTP port                  |

The repo's `.env` (gitignored) currently sets `DATABASE_URL` and `PORT`.

## Scripts

The `package.json` defines granular scripts (the README's `bun run build`,
`bun run dev`, `bun run db:init` aliases below would need to be added — see
"Notable findings"):

| Script                  | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `bun run client:build`  | Bundle client into `dist/` (minified)          |
| `bun run client:watch`  | Rebuild client on change                       |
| `bun run server:start`  | Run server (UI + API)                          |
| `bun run server:dev`    | Run server with `--watch`                      |
| `bun run typecheck`     | `tsc --noEmit` across the project              |

## Notable findings / discrepancies

These were observed while reviewing the code and may be worth addressing later:

1. **`README.md` was deleted** in the working tree (staged for deletion) and
   `AGENTS.md` was modified (unstaged). This file restores a README.
2. **Script name drift** — `package.json` exposes `client:build`, `client:watch`,
   `server:start`, `server:dev`, and `typecheck`, but **not** the `build`,
   `watch`, `start`, `dev`, or `db:init` scripts. The previous README referenced
   `bun run build` / `bun run start` / `bun run db:init`, so either scripts were
   renamed or the README was out of date. `db:init` in particular is no longer a
   script even though the server auto-applies `schema.sql`.
3. **Updates use `POST`**, not `PATCH`/`PUT` (e.g. `POST /api/tasks/{id}`,
   `POST /api/tasks/{id}/subtasks/{subtaskId}`). The OpenAPI spec matches this.
4. **Task creation locks status to `OPEN`** — `status` is rejected on create and
   can only be changed via update.
5. **`subtaskDetails` cleared wholesale** in the `TASK_REMOVED` reducer case
   (`subtaskDetails: {}`), since subtask ids aren't globally unique enough to
   prune precisely; they're refetched on demand.
6. **No `.env.example`** exists even though `.env` is gitignored; only `.env` is
   present (containing `DATABASE_URL` and `PORT`).
7. **Compile-check only** — per `AGENTS.md`, compile checks (`bun run typecheck`)
   are fine but the app/API should not be run or hit during agent work.

## Example

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Ship 2.0","description":"<p>Make it great</p>","createdBy":"alice"}'
```
