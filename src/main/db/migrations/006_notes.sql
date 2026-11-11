CREATE TABLE notes (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  remind_at      TEXT,
  remind_repeat  TEXT NOT NULL DEFAULT 'once',
  snoozed_until  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
