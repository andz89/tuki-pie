import type Database from 'better-sqlite3';
import { z } from 'zod';

const SettingRow = z.object({ key: z.string(), value: z.string() });

export class SettingsRepository {
  constructor(private readonly db: Database.Database) {}

  getAll(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries(
      SettingRow.array()
        .parse(rows)
        .map(({ key, value }) => [key, value]),
    );
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
  }
}
