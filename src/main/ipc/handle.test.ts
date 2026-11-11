import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { UserError } from '../services/user-error';
import { handle } from './handle';
import { IpcChannels } from '../../shared/ipc-channels';
import { eventFor, eventFrom } from './fake-sender';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const Input = z.tuple([z.string().max(5)]);

function register(run: (text: string) => unknown) {
  vi.mocked(ipcMain.handle).mockClear();
  handle(IpcChannels.settingsGet, Input, run);
  return vi.mocked(ipcMain.handle).mock.calls[0][1] as (
    event: unknown,
    ...args: unknown[]
  ) => Promise<unknown>;
}

beforeEach(() => {
  vi.mocked(ipcMain.handle).mockClear();
});

describe('handle', () => {
  it('refuses a window that may not send on the channel, without running the work', async () => {
    const run = vi.fn();
    const handler = register(run);
    await expect(handler(eventFrom('screenshot'), 'abc')).rejects.toThrow(
      /not allowed/,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses to register a channel no window may use', () => {
    expect(() =>
      handle('made:up', Input, (_text: string) => undefined),
    ).toThrow(/no rule/);
  });

  it('passes checked input through and wraps the answer', async () => {
    const handler = register((text) => text.toUpperCase());
    await expect(
      handler(eventFor(IpcChannels.settingsGet), 'abc'),
    ).resolves.toEqual({
      ok: true,
      value: 'ABC',
    });
  });

  it('rejects input that fails the check without running the work', async () => {
    const run = vi.fn();
    const handler = register(run);
    await expect(
      handler(eventFor(IpcChannels.settingsGet), 'too long'),
    ).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects extra input', async () => {
    const run = vi.fn();
    const handler = register(run);
    await expect(
      handler(eventFor(IpcChannels.settingsGet), 'abc', 'extra'),
    ).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it('returns a message the person can read for rule failures', async () => {
    const handler = register(() => {
      throw new UserError('Folder not found.');
    });
    await expect(
      handler(eventFor(IpcChannels.settingsGet), 'abc'),
    ).resolves.toEqual({
      ok: false,
      error: 'Folder not found.',
    });
  });

  it('does not hide programming errors behind a friendly message', async () => {
    const handler = register(() => {
      throw new Error('bug');
    });
    await expect(
      handler(eventFor(IpcChannels.settingsGet), 'abc'),
    ).rejects.toThrow('bug');
  });

  it('waits for slow work', async () => {
    const handler = register(async () => 'done');
    await expect(
      handler(eventFor(IpcChannels.settingsGet), 'abc'),
    ).resolves.toEqual({
      ok: true,
      value: 'done',
    });
  });
});
