CREATE TABLE slices (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('app', 'folder', 'note')),
  path        TEXT NOT NULL,
  position    INTEGER NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE allowed_apps (
  path        TEXT PRIMARY KEY,
  added_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL
);
