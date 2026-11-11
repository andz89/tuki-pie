import { randomUUID } from 'node:crypto';
import {
  SNOOZE_MS,
  dueTime,
  firstOccurrence,
  nextOccurrence,
} from '../../shared/reminder-time';
import { MAX_NOTES } from '../../shared/schemas/note.schema';
import type {
  DueReminder,
  NewNote,
  Note,
  NoteEdit,
  Reminder,
} from '../../shared/schemas/note.schema';
import type { NoteRepository } from '../repositories/note.repository';
import { UserError } from './user-error';

const NOTE_GONE = 'That note no longer exists.';
const PREVIEW_LENGTH = 80;

// The start of a note's text on one line, for the reminder card.
export function notePreview(body: string): string {
  const line = body.replace(/\s+/g, ' ').trim();
  return line.length <= PREVIEW_LENGTH
    ? line
    : `${line.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…`;
}

// What a change touched: only the title and text, a reminder (its time,
// snooze or end), or the note went.
export type NoteChange = 'text' | 'reminder' | 'removed';

export const noteTitle = (note: Pick<Note, 'title'>) =>
  note.title.trim() || 'Untitled note';

export class NoteService {
  private readonly listeners = new Set<(kind: NoteChange) => void>();

  constructor(
    private readonly notes: NoteRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Told after every change, so the scheduler and the windows catch up.
  onChanged(listener: (kind: NoteChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): Note[] {
    return this.notes.findAll();
  }

  // Opening Notes clears out notes left empty last time.
  listAfterCleanup(): Note[] {
    this.notes.removeEmpty();
    return this.list();
  }

  create(item: NewNote): Note {
    if (this.notes.count() >= MAX_NOTES) {
      throw new UserError(`You can keep ${MAX_NOTES} notes at most.`);
    }
    const id = randomUUID();
    this.notes.insert(id, item.title, item.body);
    this.changed('text');
    return this.existing(id);
  }

  update(edit: NoteEdit): Note {
    this.existing(edit.id);
    this.notes.update(edit);
    this.changed('text');
    return this.existing(edit.id);
  }

  remove(id: string): void {
    if (this.notes.findById(id)) {
      this.notes.remove(id);
      this.changed('removed');
    }
  }

  setReminder(id: string, reminder: Reminder | null): Note {
    this.existing(id);
    if (reminder === null) {
      this.notes.setReminder(id, null);
    } else {
      const first = firstOccurrence(new Date(reminder.at), reminder.repeat);
      if (first <= this.now()) {
        throw new UserError('Pick a time in the future.');
      }
      this.notes.setReminder(id, {
        at: first.toISOString(),
        repeat: reminder.repeat,
      });
    }
    this.changed('reminder');
    return this.existing(id);
  }

  // Reminders that should show now, the longest waiting first. Only the
  // due ones are read in full, for their title and preview.
  due(): DueReminder[] {
    const now = this.now();
    return this.notes
      .findReminderTimes()
      .map(({ id, at, snoozedUntil }) => ({
        id,
        time: dueTime(at, snoozedUntil),
      }))
      .filter(
        (item): item is { id: string; time: Date } =>
          item.time !== null && item.time <= now,
      )
      .sort((a, b) => a.time.getTime() - b.time.getTime())
      .map(({ id }) => this.notes.findById(id))
      .filter((note): note is Note => note !== null)
      .map((note) => ({
        id: note.id,
        title: noteTitle(note),
        preview: notePreview(note.body),
      }));
  }

  // The next time a reminder will be due, after now.
  nextDueTime(): Date | null {
    const now = this.now();
    let next: Date | null = null;
    for (const { at, snoozedUntil } of this.notes.findReminderTimes()) {
      const time = dueTime(at, snoozedUntil);
      if (time && time > now && (next === null || time < next)) {
        next = time;
      }
    }
    return next;
  }

  // A one-time reminder ends. A repeating one moves to its next time.
  done(id: string): void {
    const note = this.notes.findById(id);
    if (!note?.reminder) {
      return;
    }
    const { at, repeat } = note.reminder;
    const next = nextOccurrence(new Date(at), repeat, this.now());
    this.notes.setReminder(
      id,
      next === null ? null : { at: next.toISOString(), repeat },
    );
    this.changed('reminder');
  }

  // The reminder's own times stay; the snooze rings in between.
  snooze(id: string): void {
    const note = this.notes.findById(id);
    if (!note?.reminder) {
      return;
    }
    const until = new Date(this.now().getTime() + SNOOZE_MS).toISOString();
    this.notes.setSnooze(id, until);
    this.changed('reminder');
  }

  private existing(id: string): Note {
    const note = this.notes.findById(id);
    if (!note) {
      throw new UserError(NOTE_GONE);
    }
    return note;
  }

  private changed(kind: NoteChange): void {
    for (const listener of this.listeners) {
      listener(kind);
    }
  }
}
