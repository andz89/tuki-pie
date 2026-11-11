CREATE TABLE shortcuts (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('link', 'app', 'group')),
  target      TEXT,
  parent_id   TEXT REFERENCES shortcuts (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
