import { dialog, ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { SliceService } from '../services/slice.service';
import { getPanelWindow } from '../windows/panel-window';
import { registerPanelIpc } from './panel.ipc';
import { eventFor } from './fake-sender';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));
vi.mock('../windows/panel-window', () => ({ getPanelWindow: vi.fn() }));

const slices = {
  listAllowedApps: vi.fn(() => []),
  removeAllowedApp: vi.fn(() => []),
};

function handlerFor(channel: string) {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([registered]) => registered === channel);
  if (!call) throw new Error(`${channel} handler was not registered`);
  return call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  registerPanelIpc(slices as unknown as SliceService);
});

describe('choosing a location', () => {
  const panel = { id: 'panel' };

  it('returns the chosen path', async () => {
    vi.mocked(getPanelWindow).mockReturnValue(panel as never);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['C:\\Picked'],
    });
    await expect(
      handlerFor(IpcChannels.panelPickPath)(
        eventFor(IpcChannels.panelPickPath),
        'folder',
      ),
    ).resolves.toEqual({ ok: true, value: 'C:\\Picked' });
  });

  it('asks for a folder when the slice is a folder', async () => {
    vi.mocked(getPanelWindow).mockReturnValue(panel as never);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    await handlerFor(IpcChannels.panelPickPath)(
      eventFor(IpcChannels.panelPickPath),
      'folder',
    );
    expect(dialog.showOpenDialog).toHaveBeenCalledExactlyOnceWith(
      panel,
      expect.objectContaining({ properties: ['openDirectory'] }),
    );
  });

  it('returns nothing when cancelled', async () => {
    vi.mocked(getPanelWindow).mockReturnValue(panel as never);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    await expect(
      handlerFor(IpcChannels.panelPickPath)(
        eventFor(IpcChannels.panelPickPath),
        'note',
      ),
    ).resolves.toEqual({ ok: true, value: null });
  });
});
