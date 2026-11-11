import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../db/migrate';
import { NoteRepository } from '../repositories/note.repository';
import { NoteService, notePreview } from './note.service';
import { UserError } from './user-error';

let now: Date;
let repository: NoteRepository;
let service: NoteService;
let changed: ReturnType<typeof vi.fn<(kind: string) => void>>;

const local = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 10, day, hours, minutes);

beforeEach(() => {
  const db = new Database(':memory:');
  migrate(db);
  repository = new NoteRepository(db);
  // Wednesday 11 November 2026, 10:00.
  now = local(11, 10);
  service = new NoteService(repository, () => now);
  changed = vi.fn();
  service.onChanged(changed);
});

const remind = (
  id: string,
  at: Date,
  repeat: 'once' | 'daily' | 'weekdays' | 'weekly' = 'once',
) => service.setReminder(id, { at: at.toISOString(), repeat });

describe('NoteService', () => {
  it('says what kind of change it was', () => {
    const note = service.create({ title: 'Trip', body: 'hotel' });
    service.update({ id: note.id, title: 'Trip', body: 'flights' });
    remind(note.id, local(11, 12));
    service.snooze(note.id);
    service.done(note.id);
    service.remove(note.id);
    expect(changed.mock.calls.map(([kind]) => kind)).toEqual([
      'text',
      'text',
      'reminder',
      'reminder',
      'reminder',
      'removed',
    ]);
  });

  it('reads only reminder times to find the next one, not every note body', () => {
    const note = service.create({ title: 'Trip', body: 'x'.repeat(1000) });
    remind(note.id, local(11, 12));
    const byId = vi.spyOn(repository, 'findById');
    const all = vi.spyOn(repository, 'findAll');
    expect(service.nextDueTime()).toEqual(local(11, 12));
    expect(service.due()).toEqual([]);
    expect(byId).not.toHaveBeenCalled();
    expect(all).not.toHaveBeenCalled();
  });

  it('creates, updates and removes notes, telling listeners', () => {
    const note = service.create({ title: 'Trip', body: 'hotel' });
    expect(
      service.update({ id: note.id, title: 'Trip', body: 'flights' }),
    ).toMatchObject({ body: 'flights' });
    service.remove(note.id);
    expect(service.list()).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it('says when a note is gone', () => {
    expect(() => service.update({ id: 'x', title: '', body: '' })).toThrow(
      UserError,
    );
  });

  it('stops at the most notes', () => {
    vi.spyOn(repository, 'count').mockReturnValue(1000);
    expect(() => service.create({ title: 'a', body: '' })).toThrow(
      'You can keep 1000 notes at most.',
    );
  });

  it('clears out empty notes when listing for the window', () => {
    service.create({ title: '', body: ' ' });
    service.create({ title: 'Kept', body: '' });
    expect(service.listAfterCleanup().map(({ title }) => title)).toEqual([
      'Kept',
    ]);
  });

  it('refuses a reminder in the past', () => {
    const { id } = service.create({ title: 'a', body: '' });
    expect(() => remind(id, local(11, 9))).toThrow(
      'Pick a time in the future.',
    );
  });

  it('starts a weekday reminder set for Saturday on Monday', () => {
    const { id } = service.create({ title: 'a', body: '' });
    expect(remind(id, local(14, 9), 'weekdays').reminder?.at).toBe(
      local(16, 9).toISOString(),
    );
  });

  it('lists due reminders, longest waiting first, and the next time', () => {
    const first = service.create({ title: 'First', body: 'a\n b' });
    const second = service.create({ title: '', body: '' });
    const later = service.create({ title: 'Later', body: '' });
    remind(first.id, local(11, 11));
    remind(second.id, local(11, 12));
    remind(later.id, local(12, 9));

    expect(service.due()).toEqual([]);
    expect(service.nextDueTime()).toEqual(local(11, 11));

    now = local(11, 13);
    expect(service.due()).toEqual([
      { id: first.id, title: 'First', preview: 'a b' },
      { id: second.id, title: 'Untitled note', preview: '' },
    ]);
    expect(service.nextDueTime()).toEqual(local(12, 9));
  });

  it('ends a one-time reminder on Done', () => {
    const { id } = service.create({ title: 'a', body: '' });
    remind(id, local(11, 11));
    now = local(11, 11, 5);
    service.done(id);
    expect(repository.findById(id)?.reminder).toBeNull();
    expect(service.due()).toEqual([]);
  });

  it('moves a repeating reminder on Done, even after days away', () => {
    const { id } = service.create({ title: 'a', body: '' });
    remind(id, local(11, 11), 'daily');
    now = local(14, 8);
    service.done(id);
    expect(repository.findById(id)?.reminder).toEqual({
      at: local(14, 11).toISOString(),
      repeat: 'daily',
    });
  });

  it('snoozes for 10 minutes without moving the reminder', () => {
    const { id } = service.create({ title: 'a', body: '' });
    remind(id, local(11, 11), 'daily');
    now = local(11, 11);
    service.snooze(id);
    expect(service.due()).toEqual([]);
    expect(service.nextDueTime()).toEqual(local(11, 11, 10));
    expect(repository.findById(id)?.reminder?.at).toBe(
      local(11, 11).toISOString(),
    );

    now = local(11, 11, 10);
    expect(service.due().map((due) => due.id)).toEqual([id]);
    service.done(id);
    expect(repository.findById(id)).toMatchObject({
      reminder: { at: local(12, 11).toISOString() },
      snoozedUntil: null,
    });
  });

  it('ignores Done and Snooze for a note without a reminder', () => {
    const { id } = service.create({ title: 'a', body: '' });
    changed.mockClear();
    service.done(id);
    service.snooze('gone');
    expect(changed).not.toHaveBeenCalled();
  });
});

describe('notePreview', () => {
  it('puts the text on one line and shortens it', () => {
    expect(notePreview('  a\n\n b ')).toBe('a b');
    const long = notePreview('word '.repeat(40));
    expect(long).toHaveLength(80);
    expect(long.endsWith('…')).toBe(true);
  });
});
