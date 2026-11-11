import { dueTime } from '../../shared/reminder-time';
import type { Note } from '../../shared/types';

const PREVIEW_LENGTH = 60;

export const displayTitle = (title: string) => title.trim() || 'Untitled note';

// Plenty for a 60-character preview, after squashing spaces. A note can be
// very long, and the list redraws as you type.
const PREVIEW_SOURCE = 400;

// The first line of text under the title in the list.
export function listPreview(body: string): string {
  const line = body
    .trimStart()
    .slice(0, PREVIEW_SOURCE)
    .replace(/\s+/g, ' ')
    .trim();
  return line.length <= PREVIEW_LENGTH
    ? line
    : `${line.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…`;
}

// The list after a save: the note at the top, as the most recently changed,
// in place of its old copy.
export function withSavedNote(notes: Note[], saved: Note): Note[] {
  return [saved, ...notes.filter(({ id }) => id !== saved.id)];
}

// Notes whose title or text holds every word typed, ignoring case.
export function filterNotes(notes: Note[], query: string): Note[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return notes;
  }
  return notes.filter((note) => {
    const text = `${note.title}\n${note.body}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

// When the note's reminder rings next: the snooze first.
export function nextRing(note: Note): Date | null {
  return dueTime(note.reminder?.at ?? null, note.snoozedUntil);
}

export const isBlank = (title: string, body: string) =>
  title.trim() === '' && body.trim() === '';

// The value a datetime-local field wants, in local time.
export function toLocalInput(time: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}T${pad(time.getHours())}:${pad(time.getMinutes())}`;
}
