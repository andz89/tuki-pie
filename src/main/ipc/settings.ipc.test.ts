import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { SettingsService } from '../services/settings.service';
import { UserError } from '../services/user-error';
import { setOpenKeys } from '../shortcuts/open-keys';
import { setPiePin, setPieSize } from '../windows/pie-window';
import { registerSettingsIpc } from './settings.ipc';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('../windows/pie-window', () => ({
  setPiePin: vi.fn(),
  setPieSize: vi.fn(),
}));
vi.mock('../shortcuts/open-keys', () => ({ setOpenKeys: vi.fn() }));

const saved = {
  theme: 'dark',
  accent: '#2563EB',
  size: 'large',
  pin: 'pinned',
};
const onChanged = vi.fn();
const settings = { get: vi.fn(() => saved), update: vi.fn(() => saved) };

function handlerFor(channel: string) {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`${channel} handler was not registered`);
  return call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  registerSettingsIpc(settings as unknown as SettingsService, onChanged);
});

describe('settings IPC', () => {
  it('reports a saved change, so Chrome gets the suggestions switch', async () => {
    await handlerFor(IpcChannels.settingsUpdate)(
      {},
      { suggestionsInChrome: 'off' },
    );
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('saves a change and returns the new settings', async () => {
    await expect(
      handlerFor(IpcChannels.settingsUpdate)({}, { theme: 'dark' }),
    ).resolves.toEqual({ ok: true, value: saved });
    expect(settings.update).toHaveBeenCalledExactlyOnceWith({ theme: 'dark' });
  });

  it('resizes the donut window to the saved size', async () => {
    await handlerFor(IpcChannels.settingsUpdate)({}, { size: 'large' });
    expect(setPieSize).toHaveBeenCalledExactlyOnceWith('large');
  });

  it('applies the saved pin to the donut window', async () => {
    await handlerFor(IpcChannels.settingsUpdate)({}, { pin: 'pinned' });
    expect(setPiePin).toHaveBeenCalledExactlyOnceWith('pinned');
  });

  it('registers new open keys before saving them', async () => {
    await handlerFor(IpcChannels.settingsUpdate)(
      {},
      { openKeys: 'Ctrl+Alt+P' },
    );
    expect(setOpenKeys).toHaveBeenCalledExactlyOnceWith('Ctrl+Alt+P');
    expect(settings.update).toHaveBeenCalledOnce();
  });

  it('does not save open keys that are refused', async () => {
    vi.mocked(setOpenKeys).mockImplementationOnce(() => {
      throw new UserError('Those keys are already used by another app.');
    });
    await expect(
      handlerFor(IpcChannels.settingsUpdate)({}, { openKeys: 'Ctrl+Alt+P' }),
    ).resolves.toEqual({
      ok: false,
      error: 'Those keys are already used by another app.',
    });
    expect(settings.update).not.toHaveBeenCalled();
  });

  it('leaves the open keys alone when they are not changed', async () => {
    await handlerFor(IpcChannels.settingsUpdate)({}, { theme: 'light' });
    expect(setOpenKeys).not.toHaveBeenCalled();
  });

  it.each([
    [{ accent: 'red' }],
    [{ theme: 'blue' }],
    [{ size: 'huge' }],
    [{ pin: 'yes' }],
  ])('rejects %o without saving', async (changes) => {
    await expect(
      handlerFor(IpcChannels.settingsUpdate)({}, changes),
    ).rejects.toThrow();
    expect(settings.update).not.toHaveBeenCalled();
  });
});
