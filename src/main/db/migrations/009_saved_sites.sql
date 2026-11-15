CREATE TABLE saved_sites (
  id              TEXT PRIMARY KEY,
  address         TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  report          TEXT NOT NULL,
  note            TEXT NOT NULL DEFAULT '',
  has_screenshot  INTEGER NOT NULL DEFAULT 0,
  saved_at        TEXT NOT NULL
);
