import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { NoteService } from '../services/note.service';
import { openNotesWindow } from '../windows/notes-window';
import { registerNotesIpc, registerReminderIpc } from './notes.ipc';
import { eventFor } from './fake-sender';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('../windows/notes-window', () => ({
  openNotesWindow: vi.fn(),
  takeNoteRequest: vi.fn(() => 'requested'),
}));
vi.mock('../windows/reminder-window', () => ({
  dueReminders: vi.fn(() => []),
  fitReminderCard: vi.fn(),
}));

function handlerFor(channel: string) {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([registered]) => registered === channel);
  if (!call) throw new Error(`${channel} handler was not registered`);
  return call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
}

const notes = {
  list: vi.fn(() => []),
  listAfterCleanup: vi.fn(() => []),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  setReminder: vi.fn(),
  done: vi.fn(),
  snooze: vi.fn(),
};

beforeEach(() => {
  vi.mocked(ipcMain.handle).mockClear();
  vi.mocked(openNotesWindow).mockClear();
  Object.values(notes).forEach((fn) => fn.mockClear());
  registerNotesIpc(notes as unknown as NoteService);
  registerReminderIpc(notes as unknown as NoteService);
});

describe('notes IPC', () => {
  it('cleans up empty notes only when asked', async () => {
    await handlerFor(IpcChannels.notesList)(
      eventFor(IpcChannels.notesList),
      false,
    );
    expect(notes.list).toHaveBeenCalledOnce();
    expect(notes.listAfterCleanup).not.toHaveBeenCalled();
    await handlerFor(IpcChannels.notesList)(
      eventFor(IpcChannels.notesList),
      true,
    );
    expect(notes.listAfterCleanup).toHaveBeenCalledOnce();
  });

  it('saves a note edit', async () => {
    const edit = { id: 'a', title: 'T', body: 'B' };
    await handlerFor(IpcChannels.notesUpdate)(
      eventFor(IpcChannels.notesUpdate),
      edit,
    );
    expect(notes.update).toHaveBeenCalledWith(edit);
  });

  it('refuses text over the limit before saving', async () => {
    await expect(
      handlerFor(IpcChannels.notesCreate)(eventFor(IpcChannels.notesCreate), {
        title: 'x'.repeat(201),
        body: '',
      }),
    ).rejects.toThrow();
    expect(notes.create).not.toHaveBeenCalled();
  });

  it('checks a reminder before setting it', async () => {
    await handlerFor(IpcChannels.notesSetReminder)(
      eventFor(IpcChannels.notesSetReminder),
      'a',
      {
        at: '2026-11-11T09:00:00.000Z',
        repeat: 'weekdays',
      },
    );
    expect(notes.setReminder).toHaveBeenCalledOnce();
    await handlerFor(IpcChannels.notesSetReminder)(
      eventFor(IpcChannels.notesSetReminder),
      'a',
      null,
    );
    expect(notes.setReminder).toHaveBeenLastCalledWith('a', null);

    await expect(
      handlerFor(IpcChannels.notesSetReminder)(
        eventFor(IpcChannels.notesSetReminder),
        'a',
        {
          at: 'soon',
          repeat: 'hourly',
        },
      ),
    ).rejects.toThrow();
    expect(notes.setReminder).toHaveBeenCalledTimes(2);
  });

  it('hands over the note to open', async () => {
    await expect(
      handlerFor(IpcChannels.notesTakeRequest)(
        eventFor(IpcChannels.notesTakeRequest),
      ),
    ).resolves.toEqual({ ok: true, value: 'requested' });
  });
});

describe('reminder card IPC', () => {
  it('marks the reminder done, then opens the note', async () => {
    await handlerFor(IpcChannels.reminderOpen)(
      eventFor(IpcChannels.reminderOpen),
      'a',
    );
    expect(notes.done).toHaveBeenCalledWith('a');
    expect(openNotesWindow).toHaveBeenCalledWith('a');
  });

  it('snoozes and finishes by id only', async () => {
    await handlerFor(IpcChannels.reminderSnooze)(
      eventFor(IpcChannels.reminderSnooze),
      'a',
    );
    await handlerFor(IpcChannels.reminderDone)(
      eventFor(IpcChannels.reminderDone),
      'b',
    );
    expect(notes.snooze).toHaveBeenCalledWith('a');
    expect(notes.done).toHaveBeenCalledWith('b');
    await expect(
      handlerFor(IpcChannels.reminderDone)(
        eventFor(IpcChannels.reminderDone),
        '',
      ),
    ).rejects.toThrow();
  });
});
