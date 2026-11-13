import type Database from 'better-sqlite3';
import { Note } from '../../shared/schemas/note.schema';
import type { NoteEdit, Reminder } from '../../shared/schemas/note.schema';

interface NoteRow {
  id: string;
  title: string;
  body: string;
  remind_at: string | null;
  remind_repeat: string;
  snoozed_until: string | null;
  updated_at: string;
}

const COLUMNS =
  'id, title, body, remind_at, remind_repeat, snoozed_until, updated_at';

// SQLite's datetime('now') is UTC without the T and Z.
const toIso = (sqliteTime: string) =>
  new Date(`${sqliteTime.replace(' ', 'T')}Z`).toISOString();

function toNote(row: NoteRow): Note {
  return Note.parse({
    id: row.id,
    title: row.title,
    body: row.body,
    reminder:
      row.remind_at === null
        ? null
        : { at: row.remind_at, repeat: row.remind_repeat },
    snoozedUntil: row.snoozed_until,
    updatedAt: toIso(row.updated_at),
  });
}

export interface ReminderTimes {
  id: string;
  at: string;
  snoozedUntil: string | null;
}

export class NoteRepository {
  constructor(private readonly db: Database.Database) {}

  // The most recently changed first.
  findAll(): Note[] {
    const rows = this.db
      .prepare(
        `SELECT ${COLUMNS} FROM notes ORDER BY updated_at DESC, rowid DESC`,
      )
      .all() as NoteRow[];
    return rows.map(toNote);
  }

  findById(id: string): Note | null {
    const row = this.db
      .prepare(`SELECT ${COLUMNS} FROM notes WHERE id = ?`)
      .get(id) as NoteRow | undefined;
    return row === undefined ? null : toNote(row);
  }

  // Just the times, with no title or text: the scheduler looks at every
  // reminder each time a note changes, and bodies can be long.
  findReminderTimes(): ReminderTimes[] {
    const rows = this.db
      .prepare(
        'SELECT id, remind_at, snoozed_until FROM notes WHERE remind_at IS NOT NULL',
      )
      .all() as Pick<NoteRow, 'id' | 'remind_at' | 'snoozed_until'>[];
    return rows.map((row) => ({
      id: row.id,
      at: row.remind_at as string,
      snoozedUntil: row.snoozed_until,
    }));
  }

  count(): number {
    return (
      this.db.prepare('SELECT COUNT(*) AS n FROM notes').get() as { n: number }
    ).n;
  }

  insert(id: string, title: string, body: string): void {
    this.db
      .prepare('INSERT INTO notes (id, title, body) VALUES (?, ?, ?)')
      .run(id, title, body);
  }

  update({ id, title, body }: NoteEdit): void {
    this.db
      .prepare(
        "UPDATE notes SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?",
      )
      .run(title, body, id);
  }

  // Setting or removing a reminder also ends any snooze. The anchor is the
  // time the person picked; it stays while the reminder moves on.
  setReminder(id: string, reminder: Reminder | null): void {
    this.db
      .prepare(
        'UPDATE notes SET remind_at = ?, remind_anchor = ?, remind_repeat = ?, snoozed_until = NULL WHERE id = ?',
      )
      .run(
        reminder?.at ?? null,
        reminder?.at ?? null,
        reminder?.repeat ?? 'once',
        id,
      );
  }

  // A repeating reminder's next time, keeping its anchor. Ends any snooze.
  moveReminder(id: string, at: string): void {
    this.db
      .prepare(
        'UPDATE notes SET remind_at = ?, snoozed_until = NULL WHERE id = ?',
      )
      .run(at, id);
  }

  // The time repeats count from, or null without a reminder.
  findReminderAnchor(id: string): string | null {
    const row = this.db
      .prepare('SELECT remind_anchor, remind_at FROM notes WHERE id = ?')
      .get(id) as
      | { remind_anchor: string | null; remind_at: string | null }
      | undefined;
    return row?.remind_anchor ?? row?.remind_at ?? null;
  }

  setSnooze(id: string, until: string | null): void {
    this.db
      .prepare('UPDATE notes SET snoozed_until = ? WHERE id = ?')
      .run(until, id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  // Notes with no title, no text and no reminder are never worth keeping.
  removeEmpty(): void {
    this.db
      .prepare(
        "DELETE FROM notes WHERE trim(title) = '' AND trim(body, ' ' || char(9, 10, 13)) = '' AND remind_at IS NULL",
      )
      .run();
  }
}
