-- A shortcut can now be a folder or file on this computer ('path'). SQLite
-- can't change a CHECK, so the table is built again. The new table points at
-- itself under its new name; the rename then points it at "shortcuts".
CREATE TABLE shortcuts_next (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('link', 'path', 'app', 'group')),
  target      TEXT,
  parent_id   TEXT REFERENCES shortcuts_next (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO shortcuts_next (id, label, type, target, parent_id, position, created_at, updated_at)
  SELECT id, label, type, target, parent_id, position, created_at, updated_at FROM shortcuts;

DROP TABLE shortcuts;

ALTER TABLE shortcuts_next RENAME TO shortcuts;
