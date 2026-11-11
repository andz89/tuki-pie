import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../db/migrate';
import { NoteRepository } from './note.repository';

let db: Database.Database;
let notes: NoteRepository;

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
  notes = new NoteRepository(db);
});

const setUpdated = (id: string, time: string) =>
  db.prepare('UPDATE notes SET updated_at = ? WHERE id = ?').run(time, id);

describe('NoteRepository', () => {
  it('saves and reads a note, keeping its text exactly', () => {
    notes.insert('a', 'Title', '  line one\n\nline two  ');
    expect(notes.findById('a')).toMatchObject({
      id: 'a',
      title: 'Title',
      body: '  line one\n\nline two  ',
      reminder: null,
      snoozedUntil: null,
    });
    expect(notes.findById('a')?.updatedAt).toMatch(/Z$/);
    expect(notes.findById('nope')).toBeNull();
  });

  it('lists the most recently changed first', () => {
    notes.insert('old', 'Old', '');
    notes.insert('new', 'New', '');
    setUpdated('old', '2026-01-01 10:00:00');
    setUpdated('new', '2026-02-01 10:00:00');
    expect(notes.findAll().map(({ id }) => id)).toEqual(['new', 'old']);
  });

  it('updates the text', () => {
    notes.insert('a', 'A', 'x');
    notes.update({ id: 'a', title: 'B', body: 'y' });
    expect(notes.findById('a')).toMatchObject({ title: 'B', body: 'y' });
  });

  it('sets a reminder, which ends a snooze', () => {
    notes.insert('a', 'A', '');
    notes.setSnooze('a', '2026-11-11T09:10:00.000Z');
    notes.setReminder('a', { at: '2026-11-11T09:00:00.000Z', repeat: 'daily' });
    expect(notes.findById('a')).toMatchObject({
      reminder: { at: '2026-11-11T09:00:00.000Z', repeat: 'daily' },
      snoozedUntil: null,
    });
    expect(notes.findWithReminders().map(({ id }) => id)).toEqual(['a']);

    notes.setReminder('a', null);
    expect(notes.findById('a')?.reminder).toBeNull();
    expect(notes.findWithReminders()).toEqual([]);
  });

  it('removes only empty notes without a reminder', () => {
    notes.insert('empty', ' ', ' \n\t');
    notes.insert('text', '', 'hi');
    notes.insert('reminded', '', '');
    notes.setReminder('reminded', {
      at: '2026-11-11T09:00:00.000Z',
      repeat: 'once',
    });
    notes.removeEmpty();
    expect(
      notes
        .findAll()
        .map(({ id }) => id)
        .sort(),
    ).toEqual(['reminded', 'text']);
    expect(notes.count()).toBe(2);
  });

  it('removes a note', () => {
    notes.insert('a', 'A', '');
    notes.remove('a');
    expect(notes.findById('a')).toBeNull();
  });
});
