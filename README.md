# TaskBoard

![Screenshot](screenshot.png)

TaskBoard is a lightweight Kanban board for getting work done. Create tasks,
break them down into subtasks, and keep the conversation going with comments —
all in a clean three-column layout (**Open**, **In Progress**, **Done**). Write
rich-text descriptions, switch to dark mode when it gets late, and watch changes
sync live across every open tab and browser.

## Features

- Three-column board: Open / In Progress / Done
- Tasks, subtasks, and comments
- Rich-text descriptions and comments (Quill editor)
- Light and dark theme
- Real-time sync across connected clients

## Technologies

- [TypeScript](https://www.typescriptlang.org/)
- [Bun](https://bun.sh/) (server, bundler, and runtime)
- [lit-html](https://lit.dev/docs/libraries/lit-html/) (UI rendering)
- [Quill](https://quilljs.com/) (rich-text editing)
- [PostgreSQL](https://www.postgresql.org/) (via [postgres.js](https://github.com/porsager/postgres))

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.x
- [Docker](https://www.docker.com/) with Docker Compose (for PostgreSQL)

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Start PostgreSQL (binds to localhost:25432)
docker compose up -d

# 3. Apply the database schema
docker compose exec -T db psql -U postgres -d taskboard < schema.sql

# 4. Create the environment file (.env) in the project root
```

`.env`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:25432/taskboard
PORT=3000
```

```bash
# 5. Build the client bundle (emits dist/)
bun run client:build

# 6. Start the server (serves the UI and the API)
bun run server:start
```

Open http://localhost:3000.

> The server also applies `schema.sql` automatically on startup (it is
> idempotent), so step 3 is optional — but handy if you prefer to set up the
> database without starting the server.

## License

[MIT](LICENSE) © Yevgeniy Melnichuk
