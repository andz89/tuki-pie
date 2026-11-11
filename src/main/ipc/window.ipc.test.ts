import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import {
  dismissPieWindow,
  hidePieWindow,
  movePieWindowBy,
} from '../windows/pie-window';
import { openPageInfo } from '../windows/page-info-window';
import { registerWindowIpc } from './window.ipc';
import { eventFor } from './fake-sender';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock('../windows/pie-window', () => ({
  dismissPieWindow: vi.fn(),
  hidePieWindow: vi.fn(),
  movePieWindowBy: vi.fn(),
}));
vi.mock('../windows/page-info-window', () => ({ openPageInfo: vi.fn() }));

function handlerFor(channel: string) {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([registered]) => registered === channel);
  if (!call) throw new Error(`${channel} handler was not registered`);
  return call[1] as (event: unknown, ...args: unknown[]) => unknown;
}

beforeEach(() => {
  vi.mocked(ipcMain.handle).mockClear();
  vi.mocked(hidePieWindow).mockClear();
  vi.mocked(dismissPieWindow).mockClear();
  vi.mocked(movePieWindowBy).mockClear();
  registerWindowIpc();
});

describe('window dismiss IPC', () => {
  it('applies the pin rule instead of hiding outright', () => {
    handlerFor(IpcChannels.windowDismiss)(eventFor(IpcChannels.windowDismiss));
    expect(dismissPieWindow).toHaveBeenCalledOnce();
    expect(hidePieWindow).not.toHaveBeenCalled();
  });

  it('rejects unexpected input without dismissing the donut', () => {
    expect(() =>
      handlerFor(IpcChannels.windowDismiss)(
        eventFor(IpcChannels.windowDismiss),
        'now',
      ),
    ).toThrow();
    expect(dismissPieWindow).not.toHaveBeenCalled();
  });
});

describe('window hide IPC', () => {
  it('hides the donut when called with no input', () => {
    handlerFor(IpcChannels.windowHide)(eventFor(IpcChannels.windowHide));
    expect(hidePieWindow).toHaveBeenCalledOnce();
  });

  it('rejects unexpected input without hiding the donut', () => {
    expect(() =>
      handlerFor(IpcChannels.windowHide)(
        eventFor(IpcChannels.windowHide),
        'C:\\Windows\\notepad.exe',
      ),
    ).toThrow();
    expect(hidePieWindow).not.toHaveBeenCalled();
  });
});

describe('opening Page Info', () => {
  beforeEach(() => {
    vi.mocked(openPageInfo).mockClear();
  });

  it('dismisses the donut and opens the window', () => {
    handlerFor(IpcChannels.windowOpenPageInfo)(
      eventFor(IpcChannels.windowOpenPageInfo),
    );
    expect(dismissPieWindow).toHaveBeenCalledOnce();
    expect(openPageInfo).toHaveBeenCalledOnce();
  });

  it('rejects unexpected input', () => {
    expect(() =>
      handlerFor(IpcChannels.windowOpenPageInfo)(
        eventFor(IpcChannels.windowOpenPageInfo),
        'https://a.com',
      ),
    ).toThrow();
    expect(openPageInfo).not.toHaveBeenCalled();
  });
});

describe('window move IPC', () => {
  it('moves the donut by whole-pixel distances', () => {
    handlerFor(IpcChannels.windowMoveBy)(
      eventFor(IpcChannels.windowMoveBy),
      12,
      -7,
    );
    expect(movePieWindowBy).toHaveBeenCalledExactlyOnceWith(12, -7);
  });

  it.each([
    ['text', ['12', 3]],
    ['a fraction', [1.5, 3]],
    ['a missing distance', [12]],
    ['an extra value', [12, 3, 4]],
    ['an impossibly large distance', [50000, 0]],
    ['not-a-number', [Number.NaN, 0]],
  ])('rejects %s without moving the donut', (_name, input) => {
    expect(() =>
      handlerFor(IpcChannels.windowMoveBy)(
        eventFor(IpcChannels.windowMoveBy),
        ...input,
      ),
    ).toThrow();
    expect(movePieWindowBy).not.toHaveBeenCalled();
  });
});
