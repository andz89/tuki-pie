import Database from 'better-sqlite3';
import { migrate } from './migrate';

export function openDatabase(file: string) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 3000');

  return { db, isNew: migrate(db) === 0 };
}
