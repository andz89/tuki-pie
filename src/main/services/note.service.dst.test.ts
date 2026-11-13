import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/migrate';
import { NoteRepository } from '../repositories/note.repository';
import { NoteService } from './note.service';

// Berlin moves its clocks from 02:00 to 03:00 on Sunday 29 March 2026.
const savedZone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Berlin';
});
afterAll(() => {
  process.env.TZ = savedZone;
});

const march = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 2, day, hours, minutes);

describe('a daily 02:30 reminder across the spring clock change', () => {
  it('rings at 03:30 on the day of the change, then at 02:30 again', () => {
    const db = new Database(':memory:');
    migrate(db);
    const repository = new NoteRepository(db);
    let now = march(27, 12);
    const service = new NoteService(repository, () => now);
    const { id } = service.create({ title: 'a', body: '' });
    service.setReminder(id, {
      at: march(28, 2, 30).toISOString(),
      repeat: 'daily',
    });

    now = march(28, 2, 31);
    service.done(id);
    expect(repository.findById(id)?.reminder?.at).toBe(
      march(29, 3, 30).toISOString(),
    );

    now = march(29, 3, 31);
    service.done(id);
    expect(repository.findById(id)?.reminder?.at).toBe(
      march(30, 2, 30).toISOString(),
    );
  });
});
