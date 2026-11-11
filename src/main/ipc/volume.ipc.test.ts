import { ipcMain } from 'electron';
import { uIOhook } from 'uiohook-napi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import { registerVolumeIpc } from './volume.ipc';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('uiohook-napi', () => ({ uIOhook: { keyTap: vi.fn() } }));

function volumeHandler() {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === IpcChannels.windowVolume);
  if (!call) throw new Error('volume handler was not registered');
  return call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  registerVolumeIpc();
});

describe('volume IPC', () => {
  it.each([
    ['up', 0xe030],
    ['down', 0xe02e],
    ['mute', 0xe020],
  ])('presses the %s volume key', async (change, key) => {
    await volumeHandler()({}, change);
    expect(uIOhook.keyTap).toHaveBeenCalledExactlyOnceWith(key);
  });

  it('rejects anything else without pressing a key', async () => {
    await expect(volumeHandler()({}, 'loud')).rejects.toThrow();
    expect(uIOhook.keyTap).not.toHaveBeenCalled();
  });
});
