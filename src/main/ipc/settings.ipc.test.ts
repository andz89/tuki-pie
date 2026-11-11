import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { SettingsService } from '../services/settings.service';
import { registerSettingsIpc } from './settings.ipc';
import { eventFor } from './fake-sender';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const saved = {
  theme: 'dark',
  accent: '#2563EB',
  size: 'large',
  pin: 'pinned',
};
const settings = { get: vi.fn(() => saved), change: vi.fn(() => saved) };

function handlerFor(channel: string) {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`${channel} handler was not registered`);
  return call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  registerSettingsIpc(settings as unknown as SettingsService);
});

describe('settings IPC', () => {
  it('lets the donut change its look', async () => {
    await handlerFor(IpcChannels.pieSettingsUpdate)(
      eventFor(IpcChannels.pieSettingsUpdate),
      { pin: 'pinned', theme: 'light' },
    );
    expect(settings.change).toHaveBeenCalledWith({
      pin: 'pinned',
      theme: 'light',
    });
  });

  it.each([{ openKeys: 'Ctrl+A' }, { suggestionsInChrome: 'off' }])(
    'refuses any other change from the donut: %j',
    async (changes) => {
      await expect(
        handlerFor(IpcChannels.pieSettingsUpdate)(
          eventFor(IpcChannels.pieSettingsUpdate),
          changes,
        ),
      ).rejects.toThrow();
      expect(settings.change).not.toHaveBeenCalled();
    },
  );

  it('saves a change and returns the new settings', async () => {
    await expect(
      handlerFor(IpcChannels.settingsUpdate)(
        eventFor(IpcChannels.settingsUpdate),
        { theme: 'dark' },
      ),
    ).resolves.toEqual({ ok: true, value: saved });
    expect(settings.change).toHaveBeenCalledExactlyOnceWith({ theme: 'dark' });
  });

  it.each([
    [{ accent: 'red' }],
    [{ theme: 'blue' }],
    [{ size: 'huge' }],
    [{ pin: 'yes' }],
  ])('rejects %o without saving', async (changes) => {
    await expect(
      handlerFor(IpcChannels.settingsUpdate)(
        eventFor(IpcChannels.settingsUpdate),
        changes,
      ),
    ).rejects.toThrow();
    expect(settings.change).not.toHaveBeenCalled();
  });
});
