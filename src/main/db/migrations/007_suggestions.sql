CREATE TABLE suggestion_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  collapsed   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE suggestion_values (
  group_id    TEXT NOT NULL REFERENCES suggestion_groups(id) ON DELETE CASCADE,
  value       TEXT NOT NULL,
  label       TEXT,
  hidden      INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL,
  PRIMARY KEY (group_id, value)
);
