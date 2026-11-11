import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { SnippetService } from '../services/snippet.service';
import { UserError } from '../services/user-error';
import { registerSnippetIpc } from './snippets.ipc';
import { eventFor } from './fake-sender';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const snippets = {
  list: vi.fn(() => []),
  copy: vi.fn(),
  add: vi.fn(() => []),
  update: vi.fn(() => []),
  remove: vi.fn(() => []),
  reorder: vi.fn(() => []),
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
  registerSnippetIpc(snippets as unknown as SnippetService);
});

describe('snippet messages', () => {
  it('copies by id only', async () => {
    await handlerFor(IpcChannels.snippetsCopy)(
      eventFor(IpcChannels.snippetsCopy),
      'abc',
    );
    expect(snippets.copy).toHaveBeenCalledExactlyOnceWith('abc');
  });

  it('rejects text sent in place of an id', async () => {
    await expect(
      handlerFor(IpcChannels.snippetsCopy)(
        eventFor(IpcChannels.snippetsCopy),
        'x'.repeat(65),
      ),
    ).rejects.toThrow();
    expect(snippets.copy).not.toHaveBeenCalled();
  });

  it('refuses text over the limit', async () => {
    await expect(
      handlerFor(IpcChannels.panelSnippetAdd)(
        eventFor(IpcChannels.panelSnippetAdd),
        { label: 'A', content: 'x'.repeat(10001) },
      ),
    ).rejects.toThrow();
    expect(snippets.add).not.toHaveBeenCalled();
  });

  it('refuses more ids than snippets', async () => {
    const ids = Array.from({ length: 9 }, (_, n) => `id-${n}`);
    await expect(
      handlerFor(IpcChannels.panelSnippetsReorder)(
        eventFor(IpcChannels.panelSnippetsReorder),
        ids,
      ),
    ).rejects.toThrow();
    expect(snippets.reorder).not.toHaveBeenCalled();
  });

  it('passes a user error back as a message', async () => {
    snippets.copy.mockImplementationOnce(() => {
      throw new UserError('Could not copy that snippet.');
    });
    await expect(
      handlerFor(IpcChannels.snippetsCopy)(
        eventFor(IpcChannels.snippetsCopy),
        'abc',
      ),
    ).resolves.toEqual({ ok: false, error: 'Could not copy that snippet.' });
  });

  it('saves a valid new snippet', async () => {
    const item = { label: 'A', content: 'text' };
    await handlerFor(IpcChannels.panelSnippetAdd)(
      eventFor(IpcChannels.panelSnippetAdd),
      item,
    );
    expect(snippets.add).toHaveBeenCalledExactlyOnceWith(item);
  });
});
