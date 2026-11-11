import { describe, expect, it, vi } from 'vitest';
import type { NewNote, Note, NoteEdit } from '../../shared/types';
import { NoteSaver } from './note-saver';

const stored = (id: string, title: string, body: string): Note => ({
  id,
  title,
  body,
  reminder: null,
  snoozedUntil: null,
  updatedAt: '2026-11-11T09:00:00.000Z',
});

function fakeApi() {
  return {
    create: vi.fn(async ({ title, body }: NewNote) => ({
      ok: true as const,
      value: stored('new-id', title, body),
    })),
    update: vi.fn(async ({ id, title, body }: NoteEdit) => ({
      ok: true as const,
      value: stored(id, title, body),
    })),
  };
}

const EMPTY = { title: '', body: '' };

describe('NoteSaver', () => {
  it('hands over each saved note, so the list can show it without a reload', async () => {
    const api = fakeApi();
    const onSaved = vi.fn();
    const saver = new NoteSaver(api, null, EMPTY, vi.fn(), onSaved);
    await saver.save('Trip', '');
    await saver.save('Trip', 'hotel');
    expect(onSaved.mock.calls.map(([note]) => note.body)).toEqual([
      '',
      'hotel',
    ]);
  });

  it('never creates a blank new note', async () => {
    const api = fakeApi();
    await new NoteSaver(api, null, EMPTY, vi.fn()).save(' ', '\n');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('creates a new note once, then updates it, in order', async () => {
    const api = fakeApi();
    const saver = new NoteSaver(api, null, EMPTY, vi.fn());
    void saver.save('T', '');
    void saver.save('Tr', '');
    await saver.save('Trip', 'hotel');
    expect(api.create).toHaveBeenCalledExactlyOnceWith({
      title: 'T',
      body: '',
    });
    expect(api.update.mock.calls.map(([edit]) => edit)).toEqual([
      { id: 'new-id', title: 'Tr', body: '' },
      { id: 'new-id', title: 'Trip', body: 'hotel' },
    ]);
    expect(saver.noteId).toBe('new-id');
  });

  it('skips a save with nothing changed', async () => {
    const api = fakeApi();
    const saver = new NoteSaver(api, 'a', { title: 'A', body: 'x' }, vi.fn());
    await saver.save('A', 'x');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('reports a failed save and tries again next time', async () => {
    const api = fakeApi();
    api.update.mockResolvedValueOnce({
      ok: false,
      error: 'That note no longer exists.',
    } as never);
    const onError = vi.fn();
    const saver = new NoteSaver(api, 'a', { title: 'A', body: '' }, onError);
    await saver.save('B', '');
    expect(onError).toHaveBeenCalledWith('That note no longer exists.');
    await saver.save('B', '');
    expect(api.update).toHaveBeenCalledTimes(2);
  });
});
