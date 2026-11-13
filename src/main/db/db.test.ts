import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from './db';
import { migrate } from './migrate';
import init from './migrations/001_init.sql?raw';
import shortcuts from './migrations/002_shortcuts.sql?raw';
import snippets from './migrations/003_snippets.sql?raw';
import appsApart from './migrations/004_apps_apart.sql?raw';
import pathShortcuts from './migrations/005_path_shortcuts.sql?raw';
import notes from './migrations/006_notes.sql?raw';
import suggestions from './migrations/007_suggestions.sql?raw';

const MIGRATIONS_BEFORE_PATHS = [init, shortcuts, snippets, appsApart];

const folders: string[] = [];

function tempFile(): string {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pie-db-'));
  folders.push(folder);
  return path.join(folder, 'pie.db');
}

afterEach(() => {
  for (const folder of folders.splice(0)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

describe('openDatabase', () => {
  it('applies the planned connection settings', () => {
    const { db } = openDatabase(tempFile());
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(3000);
    db.close();
  });

  it('reports a brand-new database once', () => {
    const file = tempFile();
    const first = openDatabase(file);
    expect(first.isNew).toBe(true);
    first.db.close();

    const second = openDatabase(file);
    expect(second.isNew).toBe(false);
    second.db.close();
  });

  it('upgrades an older database without treating it as a first run', () => {
    const file = tempFile();
    const old = new Database(file);
    migrate(old, [init]);
    old
      .prepare(
        "INSERT INTO slices (id, label, type, path, position) VALUES ('a', 'A', 'folder', 'C:\\A', 0)",
      )
      .run();
    old.close();

    const { db, isNew } = openDatabase(file);
    expect(isNew).toBe(false);
    expect(db.pragma('user_version', { simple: true })).toBe(8);
    expect(db.prepare('SELECT id FROM slices').all()).toEqual([{ id: 'a' }]);
    expect(db.prepare('SELECT id FROM shortcuts').all()).toEqual([]);
    db.close();
  });

  it('adds snippets to a database at the previous version', () => {
    const file = tempFile();
    const old = new Database(file);
    migrate(old, [init, shortcuts]);
    old.close();

    const { db } = openDatabase(file);
    expect(db.pragma('user_version', { simple: true })).toBe(8);
    expect(db.prepare('SELECT id FROM snippets').all()).toEqual([]);
    db.close();
  });
});

describe('suggestions migration', () => {
  it('adds the suggestion tables to a database at version 6', () => {
    const file = tempFile();
    const old = new Database(file);
    migrate(old, [init, shortcuts, snippets, appsApart, pathShortcuts, notes]);
    old.close();

    const { db } = openDatabase(file);
    expect(db.pragma('user_version', { simple: true })).toBe(8);
    expect(db.prepare('SELECT id FROM suggestion_groups').all()).toEqual([]);
    expect(db.prepare('SELECT value FROM suggestion_values').all()).toEqual([]);
    db.close();
  });

  it("removes a group's values with the group", () => {
    const { db } = openDatabase(tempFile());
    db.prepare(
      "INSERT INTO suggestion_groups (id, name, position) VALUES ('g', 'Day', 0)",
    ).run();
    db.prepare(
      "INSERT INTO suggestion_values (group_id, value, position) VALUES ('g', '01', 0)",
    ).run();
    db.prepare("DELETE FROM suggestion_groups WHERE id = 'g'").run();
    expect(db.prepare('SELECT value FROM suggestion_values').all()).toEqual([]);
    db.close();
  });
});

describe('reminder anchor migration', () => {
  it('anchors existing reminders at their saved time', () => {
    const file = tempFile();
    const old = new Database(file);
    migrate(old, [
      init,
      shortcuts,
      snippets,
      appsApart,
      pathShortcuts,
      notes,
      suggestions,
    ]);
    old
      .prepare(
        "INSERT INTO notes (id, title, body, remind_at, remind_repeat) VALUES ('r', '', '', '2026-03-28T01:30:00.000Z', 'daily'), ('p', '', '', NULL, 'once')",
      )
      .run();
    old.close();

    const { db } = openDatabase(file);
    expect(
      db.prepare('SELECT id, remind_anchor FROM notes ORDER BY id').all(),
    ).toEqual([
      { id: 'p', remind_anchor: null },
      { id: 'r', remind_anchor: '2026-03-28T01:30:00.000Z' },
    ]);
    db.close();
  });
});

describe('migrate', () => {
  it('creates the tables and records the version', () => {
    const db = new Database(':memory:');
    expect(migrate(db)).toBe(0);
    expect(db.pragma('user_version', { simple: true })).toBe(8);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'slices',
        'allowed_apps',
        'settings',
        'shortcuts',
        'snippets',
        'notes',
        'suggestion_groups',
        'suggestion_values',
      ]),
    );
  });

  it('runs each migration only once', () => {
    const db = new Database(':memory:');
    migrate(db);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('a', 'b');
    expect(migrate(db)).toBe(8);
    expect(db.prepare('SELECT COUNT(*) AS n FROM settings').get()).toEqual({
      n: 1,
    });
  });

  it('keeps shortcuts, and their groups, when paths are added', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db, MIGRATIONS_BEFORE_PATHS);
    const insert = (...row: unknown[]) =>
      db
        .prepare(
          'INSERT INTO shortcuts (id, label, type, target, parent_id, position) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(...row);
    insert('g', 'Group', 'group', null, null, 0);
    insert('l', 'Link', 'link', 'https://a.com', 'g', 0);
    migrate(db);
    expect(db.prepare('SELECT id FROM shortcuts ORDER BY id').all()).toEqual([
      { id: 'g' },
      { id: 'l' },
    ]);
    insert('p', 'Folder', 'path', 'C:\\Work', null, 1);
    // Removing a group still removes what is inside it.
    db.prepare('DELETE FROM shortcuts WHERE id = ?').run('g');
    expect(db.prepare('SELECT id FROM shortcuts').all()).toEqual([{ id: 'p' }]);
  });

  it('runs migrations in order', () => {
    const db = new Database(':memory:');
    migrate(db, ['CREATE TABLE one (n);', 'ALTER TABLE one ADD COLUMN m;']);
    expect(db.pragma('user_version', { simple: true })).toBe(2);
    expect(db.prepare('SELECT * FROM one').columns()).toHaveLength(2);
  });

  it('refuses a database made by a newer version of the app', () => {
    const db = new Database(':memory:');
    db.pragma('user_version = 3');
    expect(() => migrate(db, ['CREATE TABLE one (n);'])).toThrow(
      /newer version/,
    );
    expect(db.pragma('user_version', { simple: true })).toBe(3);
  });

  it('undoes a migration that fails partway', () => {
    const db = new Database(':memory:');
    expect(() =>
      migrate(db, ['CREATE TABLE half (n); THIS IS NOT SQL;']),
    ).toThrow();
    expect(db.pragma('user_version', { simple: true })).toBe(0);
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE name = 'half'").get(),
    ).toBeUndefined();
  });
});
