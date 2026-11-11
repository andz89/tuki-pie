import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { ShortcutService } from '../services/shortcut.service';
import { takePanelFormRequest } from '../windows/panel-window';
import { registerShortcutIpc } from './shortcuts.ipc';
import { eventFor } from './fake-sender';

vi.mock('electron', () => ({
  app: { getFileIcon: vi.fn(), getPath: vi.fn(() => '/app-data') },
  nativeImage: { createFromPath: vi.fn() },
  shell: { readShortcutLink: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));
vi.mock('../windows/panel-window', () => ({ takePanelFormRequest: vi.fn() }));

const shortcuts = {
  list: vi.fn(() => []),
  find: vi.fn(),
  open: vi.fn(async () => undefined),
  addApproved: vi.fn(() => []),
  updateApproved: vi.fn(() => []),
  remove: vi.fn(() => []),
  reorder: vi.fn(() => []),
  move: vi.fn(() => []),
};
const iconOf = vi.fn(async (_id: string) => 'data:image/png;base64,AA');

function handlerFor(channel: string) {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([registered]) => registered === channel);
  if (!call) throw new Error(`${channel} handler was not registered`);
  return call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
}

const app = { type: 'app', label: 'E', target: 'C:\\e.exe', parentId: null };
const link = {
  type: 'link',
  label: 'L',
  target: 'https://a.com',
  parentId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  registerShortcutIpc(shortcuts as unknown as ShortcutService, iconOf);
});

describe('shortcut messages', () => {
  it('opens by id only', async () => {
    await handlerFor(IpcChannels.shortcutsOpen)(
      eventFor(IpcChannels.shortcutsOpen),
      'abc',
    );
    expect(shortcuts.open).toHaveBeenCalledExactlyOnceWith('abc');
  });

  it('rejects a path sent in place of an id', async () => {
    await expect(
      handlerFor(IpcChannels.shortcutsOpen)(
        eventFor(IpcChannels.shortcutsOpen),
        'x'.repeat(65),
      ),
    ).rejects.toThrow();
    expect(shortcuts.open).not.toHaveBeenCalled();
  });

  it('rejects a file link without saving', async () => {
    await expect(
      handlerFor(IpcChannels.panelShortcutAdd)(
        eventFor(IpcChannels.panelShortcutAdd),
        { ...link, target: 'file:///C:/a' },
      ),
    ).rejects.toThrow();
    expect(shortcuts.addApproved).not.toHaveBeenCalled();
  });

  it('saves from the settings window through the approving service', async () => {
    await handlerFor(IpcChannels.panelShortcutAdd)(
      eventFor(IpcChannels.panelShortcutAdd),
      app,
    );
    await handlerFor(IpcChannels.panelShortcutUpdate)(
      eventFor(IpcChannels.panelShortcutUpdate),
      { id: 'a', label: 'E', target: 'C:/new.exe' },
    );
    expect(shortcuts.addApproved).toHaveBeenCalledExactlyOnceWith(app);
    expect(shortcuts.updateApproved).toHaveBeenCalledExactlyOnceWith({
      id: 'a',
      label: 'E',
      target: 'C:/new.exe',
    });
  });

  it('reads an icon by id only', async () => {
    await expect(
      handlerFor(IpcChannels.shortcutsIcon)(
        eventFor(IpcChannels.shortcutsIcon),
        'abc',
      ),
    ).resolves.toEqual({ ok: true, value: 'data:image/png;base64,AA' });
    expect(iconOf).toHaveBeenCalledExactlyOnceWith('abc');
  });

  it('passes the row and order when moving', async () => {
    await handlerFor(IpcChannels.panelShortcutsReorder)(
      eventFor(IpcChannels.panelShortcutsReorder),
      'g',
      ['a', 'b'],
    );
    expect(shortcuts.reorder).toHaveBeenCalledExactlyOnceWith('g', ['a', 'b']);
  });

  it('passes a full apps row of 18 when reordering', async () => {
    const ids = Array.from({ length: 18 }, (_, index) => `app${index}`);
    await handlerFor(IpcChannels.panelShortcutsReorder)(
      eventFor(IpcChannels.panelShortcutsReorder),
      null,
      ids,
    );
    expect(shortcuts.reorder).toHaveBeenCalledExactlyOnceWith(null, ids);
  });

  it('refuses a reorder longer than any row', async () => {
    const ids = Array.from({ length: 19 }, (_, index) => `app${index}`);
    await expect(
      handlerFor(IpcChannels.panelShortcutsReorder)(
        eventFor(IpcChannels.panelShortcutsReorder),
        null,
        ids,
      ),
    ).rejects.toThrow();
    expect(shortcuts.reorder).not.toHaveBeenCalled();
  });

  it('passes the shortcut, row and place when moving to another row', async () => {
    await handlerFor(IpcChannels.panelShortcutMove)(
      eventFor(IpcChannels.panelShortcutMove),
      'a',
      'g',
      2,
    );
    expect(shortcuts.move).toHaveBeenCalledExactlyOnceWith('a', 'g', 2);
  });

  it.each([-1, 8, 1.5, '1'])('refuses the place %j', async (index) => {
    await expect(
      handlerFor(IpcChannels.panelShortcutMove)(
        eventFor(IpcChannels.panelShortcutMove),
        'a',
        null,
        index,
      ),
    ).rejects.toThrow();
    expect(shortcuts.move).not.toHaveBeenCalled();
  });

  it('hands over a waiting form request', async () => {
    vi.mocked(takePanelFormRequest).mockReturnValue({ kind: 'group' });
    await expect(
      handlerFor(IpcChannels.panelTakeFormRequest)(
        eventFor(IpcChannels.panelTakeFormRequest),
      ),
    ).resolves.toEqual({ ok: true, value: { kind: 'group' } });
  });
});
