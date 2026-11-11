import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openPanelWindow,
  requestPanelForm,
  takePanelFormRequest,
} from './panel-window';

const fake = vi.hoisted(() => ({
  send: vi.fn(),
  windows: 0,
  close: null as null | (() => void),
}));

vi.mock('electron', () => ({
  BrowserWindow: class {
    webContents = { send: fake.send };
    constructor() {
      fake.windows += 1;
    }
    setMenu = () => undefined;
    loadURL = () => undefined;
    once = () => undefined;
    on = (_name: string, handler: () => void) => {
      fake.close = handler;
    };
    isMinimized = () => false;
    show = () => undefined;
    focus = () => undefined;
  },
}));

beforeEach(() => {
  vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', 'http://localhost:5173');
  fake.close?.();
  takePanelFormRequest();
  fake.windows = 0;
  fake.send.mockClear();
});

describe('asking the settings window for a form', () => {
  it('hands the request over once', () => {
    requestPanelForm({ kind: 'group' });
    expect(takePanelFormRequest()).toEqual({ kind: 'group' });
    expect(takePanelFormRequest()).toBeNull();
  });

  it('opens the window when it is closed, leaving it to pick up the request', () => {
    requestPanelForm({ kind: 'section' });
    expect(fake.windows).toBe(1);
    expect(fake.send).not.toHaveBeenCalled();
  });

  it('tells a window that is already open', () => {
    openPanelWindow();
    requestPanelForm({ kind: 'shortcut', parentId: 'g' });
    expect(fake.windows).toBe(1);
    expect(fake.send).toHaveBeenCalledExactlyOnceWith('panel:form-requested');
  });
});
