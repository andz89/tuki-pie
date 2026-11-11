import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { ShortcutService } from '../services/shortcut.service';
import type { SliceService } from '../services/slice.service';
import { UserError } from '../services/user-error';
import { takePanelFormRequest } from '../windows/panel-window';
import { registerShortcutIpc } from './shortcuts.ipc';

vi.mock('electron', () => ({
  app: { getFileIcon: vi.fn() },
  nativeImage: { createFromPath: vi.fn() },
  shell: { readShortcutLink: vi.fn() },
  ipcMain: { handle: vi.fn() },
}));
vi.mock('../windows/panel-window', () => ({ takePanelFormRequest: vi.fn() }));

const shortcuts = {
  list: vi.fn(() => []),
  find: vi.fn(),
  open: vi.fn(async () => undefined),
  assertCanAdd: vi.fn(),
  assertCanUpdate: vi.fn(),
  add: vi.fn(() => []),
  update: vi.fn(() => []),
  remove: vi.fn(() => []),
  reorder: vi.fn(() => []),
  move: vi.fn(() => []),
};
const slices = { allowApp: vi.fn() };

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
  registerShortcutIpc(
    shortcuts as unknown as ShortcutService,
    slices as unknown as SliceService,
  );
});

describe('shortcut messages', () => {
  it('opens by id only', async () => {
    await handlerFor(IpcChannels.shortcutsOpen)({}, 'abc');
    expect(shortcuts.open).toHaveBeenCalledExactlyOnceWith('abc');
  });

  it('rejects a path sent in place of an id', async () => {
    await expect(
      handlerFor(IpcChannels.shortcutsOpen)({}, 'x'.repeat(65)),
    ).rejects.toThrow();
    expect(shortcuts.open).not.toHaveBeenCalled();
  });

  it('approves an app before saving it', async () => {
    await handlerFor(IpcChannels.panelShortcutAdd)({}, app);
    expect(slices.allowApp).toHaveBeenCalledExactlyOnceWith('C:\\e.exe');
    expect(slices.allowApp.mock.invocationCallOrder[0]).toBeLessThan(
      shortcuts.add.mock.invocationCallOrder[0],
    );
  });

  it('approves nothing when a new app cannot be saved', async () => {
    shortcuts.assertCanAdd.mockImplementationOnce(() => {
      throw new UserError('Nothing found at that path.');
    });
    await expect(
      handlerFor(IpcChannels.panelShortcutAdd)({}, app),
    ).resolves.toEqual({ ok: false, error: 'Nothing found at that path.' });
    expect(slices.allowApp).not.toHaveBeenCalled();
    expect(shortcuts.add).not.toHaveBeenCalled();
  });

  it('approves nothing when an edited app cannot be saved', async () => {
    shortcuts.find.mockReturnValue({ type: 'app' });
    shortcuts.assertCanUpdate.mockImplementationOnce(() => {
      throw new UserError('Nothing found at that path.');
    });
    await expect(
      handlerFor(IpcChannels.panelShortcutUpdate)(
        {},
        { id: 'a', label: 'E', target: 'C:\\typo.exe' },
      ),
    ).resolves.toEqual({ ok: false, error: 'Nothing found at that path.' });
    expect(slices.allowApp).not.toHaveBeenCalled();
    expect(shortcuts.update).not.toHaveBeenCalled();
  });

  it('does not approve anything for a link', async () => {
    await handlerFor(IpcChannels.panelShortcutAdd)({}, link);
    expect(slices.allowApp).not.toHaveBeenCalled();
    expect(shortcuts.add).toHaveBeenCalledOnce();
  });

  it('rejects a file link without saving', async () => {
    await expect(
      handlerFor(IpcChannels.panelShortcutAdd)(
        {},
        { ...link, target: 'file:///C:/a' },
      ),
    ).rejects.toThrow();
    expect(shortcuts.add).not.toHaveBeenCalled();
  });

  it('approves the new path when an app shortcut is edited', async () => {
    shortcuts.find.mockReturnValue({ type: 'app' });
    await handlerFor(IpcChannels.panelShortcutUpdate)(
      {},
      { id: 'a', label: 'E', target: 'C:\\new.exe' },
    );
    expect(slices.allowApp).toHaveBeenCalledExactlyOnceWith('C:\\new.exe');
    expect(shortcuts.update).toHaveBeenCalledOnce();
  });

  it('does not approve a link that is edited', async () => {
    shortcuts.find.mockReturnValue({ type: 'link' });
    await handlerFor(IpcChannels.panelShortcutUpdate)(
      {},
      { id: 'a', label: 'L', target: 'C:\\evil.exe' },
    );
    expect(slices.allowApp).not.toHaveBeenCalled();
  });

  it('passes the row and order when moving', async () => {
    await handlerFor(IpcChannels.panelShortcutsReorder)({}, 'g', ['a', 'b']);
    expect(shortcuts.reorder).toHaveBeenCalledExactlyOnceWith('g', ['a', 'b']);
  });

  it('passes a full apps row of 18 when reordering', async () => {
    const ids = Array.from({ length: 18 }, (_, index) => `app${index}`);
    await handlerFor(IpcChannels.panelShortcutsReorder)({}, null, ids);
    expect(shortcuts.reorder).toHaveBeenCalledExactlyOnceWith(null, ids);
  });

  it('refuses a reorder longer than any row', async () => {
    const ids = Array.from({ length: 19 }, (_, index) => `app${index}`);
    await expect(
      handlerFor(IpcChannels.panelShortcutsReorder)({}, null, ids),
    ).rejects.toThrow();
    expect(shortcuts.reorder).not.toHaveBeenCalled();
  });

  it('passes the shortcut, row and place when moving to another row', async () => {
    await handlerFor(IpcChannels.panelShortcutMove)({}, 'a', 'g', 2);
    expect(shortcuts.move).toHaveBeenCalledExactlyOnceWith('a', 'g', 2);
  });

  it.each([-1, 8, 1.5, '1'])('refuses the place %j', async (index) => {
    await expect(
      handlerFor(IpcChannels.panelShortcutMove)({}, 'a', null, index),
    ).rejects.toThrow();
    expect(shortcuts.move).not.toHaveBeenCalled();
  });

  it('hands over a waiting form request', async () => {
    vi.mocked(takePanelFormRequest).mockReturnValue({ kind: 'group' });
    await expect(
      handlerFor(IpcChannels.panelTakeFormRequest)({}),
    ).resolves.toEqual({ ok: true, value: { kind: 'group' } });
  });
});
