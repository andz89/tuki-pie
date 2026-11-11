import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import { openPanelWindow, requestPanelForm } from '../windows/panel-window';
import { dismissPieWindow, hidePieWindow } from '../windows/pie-window';
import { registerWindowIpc } from './window.ipc';
import { eventFrom } from './fake-sender';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('../windows/pie-window', () => ({
  dismissPieWindow: vi.fn(),
  hidePieWindow: vi.fn(),
  movePieWindowBy: vi.fn(),
}));
vi.mock('../windows/panel-window', () => ({
  openPanelWindow: vi.fn(),
  requestPanelForm: vi.fn(),
}));

function openSettingsHandler() {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === IpcChannels.windowOpenSettings);
  if (!call) throw new Error('open settings handler was not registered');
  return call[1] as (event: unknown, ...args: unknown[]) => unknown;
}

beforeEach(() => {
  vi.clearAllMocks();
  registerWindowIpc();
});

describe('open shortcut form IPC', () => {
  const handler = () => {
    const call = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([name]) => name === IpcChannels.windowOpenShortcutForm);
    if (!call) throw new Error('open form handler was not registered');
    return call[1] as (event: unknown, ...args: unknown[]) => unknown;
  };

  it('dismisses the donut by the pin rule and asks for the form', () => {
    const request = { kind: 'shortcut', parentId: 'g' };
    handler()(eventFrom('pie'), request);
    expect(dismissPieWindow).toHaveBeenCalledOnce();
    expect(requestPanelForm).toHaveBeenCalledExactlyOnceWith(request);
  });

  it('rejects an unknown request and does nothing', () => {
    expect(() => handler()(eventFrom('pie'), { kind: 'nope' })).toThrow();
    expect(dismissPieWindow).not.toHaveBeenCalled();
    expect(requestPanelForm).not.toHaveBeenCalled();
  });
});

describe('open settings IPC', () => {
  it('dismisses the donut by the pin rule and opens the settings window', () => {
    openSettingsHandler()(eventFrom('pie'));
    expect(dismissPieWindow).toHaveBeenCalledOnce();
    expect(hidePieWindow).not.toHaveBeenCalled();
    expect(openPanelWindow).toHaveBeenCalledOnce();
  });

  it('rejects unexpected input without opening anything', () => {
    expect(() =>
      openSettingsHandler()(eventFrom('pie'), 'panel.html'),
    ).toThrow();
    expect(openPanelWindow).not.toHaveBeenCalled();
  });
});
