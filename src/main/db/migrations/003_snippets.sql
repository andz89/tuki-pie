CREATE TABLE snippets (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  content     TEXT NOT NULL,
  position    INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
