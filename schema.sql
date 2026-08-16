-- TaskBoard schema (idempotent; safe to run repeatedly).

CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    -- Rich text stored as sanitized HTML (empty string when not provided).
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN', 'IN PROGRESS', 'DONE')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  TEXT NOT NULL DEFAULT 'unknown'
);

CREATE TABLE IF NOT EXISTS subtasks (
    id          SERIAL PRIMARY KEY,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    -- Rich text stored as sanitized HTML (empty string when not provided).
    description TEXT NOT NULL DEFAULT '',
    done        BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  TEXT NOT NULL DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS subtasks_task_id_idx ON subtasks(task_id);

CREATE TABLE IF NOT EXISTS comments (
    id          SERIAL PRIMARY KEY,
    -- A comment belongs to exactly one owner: a task or a subtask.
    task_id     INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    subtask_id  INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
    -- Rich text stored as sanitized HTML.
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  TEXT NOT NULL DEFAULT 'unknown',
    CONSTRAINT comments_owner_check CHECK (task_id IS NOT NULL OR subtask_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS comments_task_id_idx ON comments(task_id);
CREATE INDEX IF NOT EXISTS comments_subtask_id_idx ON comments(subtask_id);

-- Migrate databases created before rich text switched from JSONB Deltas to HTML.
-- No-ops on a fresh database (the columns are already TEXT).
ALTER TABLE tasks     ALTER COLUMN description TYPE TEXT USING description::text;
ALTER TABLE subtasks  ALTER COLUMN description TYPE TEXT USING description::text;
ALTER TABLE comments  ALTER COLUMN body        TYPE TEXT USING body::text;
