import { dialog, ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { SliceService } from '../services/slice.service';
import { getPanelWindow } from '../windows/panel-window';
import { registerPanelIpc } from './panel.ipc';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));
vi.mock('../windows/panel-window', () => ({ getPanelWindow: vi.fn() }));

const slices = {
  add: vi.fn(() => []),
  update: vi.fn(() => []),
  remove: vi.fn(() => []),
  reorder: vi.fn(() => []),
  allowApp: vi.fn(),
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

describe('saving from the settings window', () => {
  const app = { label: 'Editor', type: 'app', path: 'C:\\e.exe' };
  const folder = { label: 'Work', type: 'folder', path: 'C:\\Work' };

  it('approves an app the person saved', async () => {
    await handlerFor(IpcChannels.panelSliceAdd)({}, app);
    expect(slices.allowApp).toHaveBeenCalledExactlyOnceWith('C:\\e.exe');
    expect(slices.add).toHaveBeenCalledOnce();
  });

  it('approves an app the person changed a slice to', async () => {
    await handlerFor(IpcChannels.panelSliceUpdate)({}, { ...app, id: 'a' });
    expect(slices.allowApp).toHaveBeenCalledExactlyOnceWith('C:\\e.exe');
  });

  it('does not add folders to the allowed apps', async () => {
    await handlerFor(IpcChannels.panelSliceAdd)({}, folder);
    expect(slices.allowApp).not.toHaveBeenCalled();
  });

  it('rejects a slice with an unknown type', async () => {
    await expect(
      handlerFor(IpcChannels.panelSliceAdd)({}, { ...folder, type: 'script' }),
    ).rejects.toThrow();
    expect(slices.add).not.toHaveBeenCalled();
    expect(slices.allowApp).not.toHaveBeenCalled();
  });

  it('rejects a name longer than the limit', async () => {
    await expect(
      handlerFor(IpcChannels.panelSliceAdd)(
        {},
        { ...folder, label: 'x'.repeat(25) },
      ),
    ).rejects.toThrow();
  });
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
      handlerFor(IpcChannels.panelPickPath)({}, 'folder'),
    ).resolves.toEqual({ ok: true, value: 'C:\\Picked' });
  });

  it('asks for a folder when the slice is a folder', async () => {
    vi.mocked(getPanelWindow).mockReturnValue(panel as never);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    await handlerFor(IpcChannels.panelPickPath)({}, 'folder');
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
      handlerFor(IpcChannels.panelPickPath)({}, 'note'),
    ).resolves.toEqual({ ok: true, value: null });
  });
});
