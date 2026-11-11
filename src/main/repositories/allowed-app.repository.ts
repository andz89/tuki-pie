import type Database from 'better-sqlite3';
import { z } from 'zod';

const AllowedAppRow = z.object({ path: z.string() });

export class AllowedAppRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): string[] {
    const rows = this.db
      .prepare('SELECT path FROM allowed_apps ORDER BY path')
      .all();
    return AllowedAppRow.array()
      .parse(rows)
      .map((row) => row.path);
  }

  has(path: string): boolean {
    return (
      this.db
        .prepare('SELECT path FROM allowed_apps WHERE path = ?')
        .get(path) !== undefined
    );
  }

  add(path: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO allowed_apps (path) VALUES (?)')
      .run(path);
  }

  remove(path: string): void {
    this.db.prepare('DELETE FROM allowed_apps WHERE path = ?').run(path);
  }
}
