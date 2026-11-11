import { clipboard, ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { PairingCode } from '../chrome-bridge/pairing-code';
import { getPanelWindow } from '../windows/panel-window';
import { registerChromeIpc } from './chrome.ipc';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  clipboard: { writeText: vi.fn() },
}));
vi.mock('../windows/panel-window', () => ({ getPanelWindow: vi.fn() }));

function handlerFor(channel: string) {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([registered]) => registered === channel);
  if (!call) throw new Error(`${channel} handler was not registered`);
  return call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
}

let code: string;
let statusListener: (status: string) => void;
const pairing = {
  get: vi.fn(() => code),
  renew: vi.fn(() => {
    code = 'new-code';
    return code;
  }),
};
const bridge = {
  status: vi.fn(() => 'connected' as const),
  onStatus: vi.fn((listener) => {
    statusListener = listener;
    return () => undefined;
  }),
  dropConnection: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  code = 'old-code';
  registerChromeIpc(pairing as unknown as PairingCode, bridge);
});

describe('Chrome settings messages', () => {
  it('gives the status and the code', async () => {
    await expect(handlerFor(IpcChannels.panelChromeGet)({})).resolves.toEqual({
      ok: true,
      value: { status: 'connected', code: 'old-code' },
    });
  });

  it('makes a new code and disconnects Chrome', async () => {
    await expect(
      handlerFor(IpcChannels.panelChromeNewCode)({}),
    ).resolves.toMatchObject({ value: { code: 'new-code' } });
    expect(bridge.dropConnection).toHaveBeenCalledOnce();
  });

  it('copies the code', async () => {
    await handlerFor(IpcChannels.panelChromeCopyCode)({});
    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith('old-code');
  });

  it('tells the settings window when the status changes', () => {
    const send = vi.fn();
    vi.mocked(getPanelWindow).mockReturnValue({
      webContents: { send },
    } as unknown as ReturnType<typeof getPanelWindow>);
    statusListener('not-connected');
    expect(send).toHaveBeenCalledWith(
      IpcChannels.panelChromeStatus,
      'not-connected',
    );
  });

  it('refuses extra arguments', async () => {
    await expect(
      handlerFor(IpcChannels.panelChromeGet)({}, 'x'),
    ).rejects.toThrow();
  });
});
