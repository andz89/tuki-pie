import { describe, expect, it } from 'vitest';
import type { Note } from '../../shared/types';
import {
  displayTitle,
  filterNotes,
  isBlank,
  listPreview,
  withSavedNote,
  nextRing,
  toLocalInput,
} from './notes-view';

const note = (id: string, title: string, body: string): Note => ({
  id,
  title,
  body,
  reminder: null,
  snoozedUntil: null,
  updatedAt: '2026-11-11T09:00:00.000Z',
});

const NOTES = [
  note('a', 'Italy trip', 'Book the hotel\nflights'),
  note('b', 'Groceries', 'milk, bread'),
];

describe('filterNotes', () => {
  it('needs every word, in the title or text, ignoring case', () => {
    expect(filterNotes(NOTES, 'ITALY hotel').map(({ id }) => id)).toEqual([
      'a',
    ]);
    expect(filterNotes(NOTES, 'bread').map(({ id }) => id)).toEqual(['b']);
    expect(filterNotes(NOTES, '  ')).toBe(NOTES);
  });
});

describe('list text', () => {
  it('names untitled notes and previews one line', () => {
    expect(displayTitle('  ')).toBe('Untitled note');
    expect(listPreview('a\n\n  b')).toBe('a b');
    expect(listPreview('x'.repeat(100))).toHaveLength(60);
  });

  it('makes a preview from the start of a very long note', () => {
    const body = `  first words ${'x '.repeat(500000)}`;
    expect(listPreview(body).startsWith('first words x x')).toBe(true);
    expect(listPreview(body)).toHaveLength(60);
  });

  it('puts a saved note at the top of the list, in place of its old copy', () => {
    const list = [note('a', 'A', ''), note('b', 'B', ''), note('c', 'C', '')];
    expect(
      withSavedNote(list, note('b', 'B2', '')).map(({ id, title }) => [
        id,
        title,
      ]),
    ).toEqual([
      ['b', 'B2'],
      ['a', 'A'],
      ['c', 'C'],
    ]);
    expect(withSavedNote(list, note('d', 'D', ''))[0].id).toBe('d');
  });

  it('knows a blank note', () => {
    expect(isBlank(' ', '\n')).toBe(true);
    expect(isBlank('', 'a')).toBe(false);
  });
});

describe('nextRing', () => {
  it('prefers the snooze over the reminder', () => {
    const reminded: Note = {
      ...NOTES[0],
      reminder: { at: '2026-11-11T09:00:00.000Z', repeat: 'once' },
      snoozedUntil: '2026-11-11T09:10:00.000Z',
    };
    expect(nextRing(reminded)).toEqual(new Date('2026-11-11T09:10:00.000Z'));
    expect(nextRing(NOTES[1])).toBeNull();
  });
});

describe('toLocalInput', () => {
  it('formats local time for a date-and-time field', () => {
    expect(toLocalInput(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});
