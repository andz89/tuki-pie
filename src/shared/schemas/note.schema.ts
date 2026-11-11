import { z } from 'zod';
import { REPEATS } from '../reminder-time';

export const MAX_NOTES = 1000;
export const MAX_NOTE_TITLE = 200;
export const MAX_NOTE_BODY = 100000;

const Id = z.string().min(1).max(64);
// Text is never trimmed: a note keeps its spaces and line breaks.
const Title = z.string().max(MAX_NOTE_TITLE);
const Body = z.string().max(MAX_NOTE_BODY);
// An ISO time, like 2026-11-11T09:00:00.000Z.
export const IsoTime = z
  .string()
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)));

export const Repeat = z.enum(REPEATS);

export const Reminder = z.object({ at: IsoTime, repeat: Repeat });

export const Note = z.object({
  id: Id,
  title: Title,
  body: Body,
  reminder: Reminder.nullable(),
  snoozedUntil: IsoTime.nullable(),
  updatedAt: IsoTime,
});

export const NewNote = z.object({ title: Title, body: Body });

export const NoteEdit = z.object({ id: Id, title: Title, body: Body });

// One line of the reminder card.
export interface DueReminder {
  id: string;
  title: string;
  preview: string;
}

export type Reminder = z.infer<typeof Reminder>;
export type Note = z.infer<typeof Note>;
export type NewNote = z.infer<typeof NewNote>;
export type NoteEdit = z.infer<typeof NoteEdit>;
