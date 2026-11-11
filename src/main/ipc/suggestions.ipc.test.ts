import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { SuggestionService } from '../services/suggestion.service';
import { registerSuggestionIpc } from './suggestions.ipc';
import { eventFor } from './fake-sender';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));

const suggestions = {
  list: vi.fn(() => []),
  apply: vi.fn(() => []),
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
  registerSuggestionIpc(suggestions as unknown as SuggestionService);
});

describe('suggestion messages', () => {
  it('lists', async () => {
    await expect(
      handlerFor(IpcChannels.panelSuggestionsList)(
        eventFor(IpcChannels.panelSuggestionsList),
      ),
    ).resolves.toEqual({ ok: true, value: [] });
  });

  it('passes a valid change on', async () => {
    const change = { kind: 'add-group', name: 'Day' };
    await handlerFor(IpcChannels.panelSuggestionsChange)(
      eventFor(IpcChannels.panelSuggestionsChange),
      change,
    );
    expect(suggestions.apply).toHaveBeenCalledExactlyOnceWith(change);
  });

  it('refuses an unknown change', async () => {
    await expect(
      handlerFor(IpcChannels.panelSuggestionsChange)(
        eventFor(IpcChannels.panelSuggestionsChange),
        { kind: 'drop-all' },
      ),
    ).rejects.toThrow();
    expect(suggestions.apply).not.toHaveBeenCalled();
  });

  it('refuses a name over the limit', async () => {
    await expect(
      handlerFor(IpcChannels.panelSuggestionsChange)(
        eventFor(IpcChannels.panelSuggestionsChange),
        { kind: 'add-group', name: 'x'.repeat(41) },
      ),
    ).rejects.toThrow();
    expect(suggestions.apply).not.toHaveBeenCalled();
  });
});
