import type Database from 'better-sqlite3';
import init from './migrations/001_init.sql?raw';
import shortcuts from './migrations/002_shortcuts.sql?raw';
import snippets from './migrations/003_snippets.sql?raw';
import appsApart from './migrations/004_apps_apart.sql?raw';
import pathShortcuts from './migrations/005_path_shortcuts.sql?raw';
import notes from './migrations/006_notes.sql?raw';
import suggestions from './migrations/007_suggestions.sql?raw';

const MIGRATIONS = [
  init,
  shortcuts,
  snippets,
  appsApart,
  pathShortcuts,
  notes,
  suggestions,
];

// Runs each migration not yet applied, and returns the version it started from.
export function migrate(
  db: Database.Database,
  migrations: string[] = MIGRATIONS,
): number {
  const startVersion = db.pragma('user_version', { simple: true }) as number;

  migrations.slice(startVersion).forEach((sql, index) => {
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${startVersion + index + 1}`);
    })();
  });

  return startVersion;
}
