import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applySiteRules, createSiteViewer } from './site-window';

vi.mock('electron', () => ({
  BrowserWindow: Object.assign(vi.fn(), { fromWebContents: vi.fn() }),
  session: {
    fromPartition: vi.fn(() => ({
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      on: vi.fn(),
    })),
  },
}));

type FakeContents = EventEmitter & {
  setWindowOpenHandler: ReturnType<typeof vi.fn>;
};

function fakeContents(): FakeContents {
  return Object.assign(new EventEmitter(), {
    setWindowOpenHandler: vi.fn(),
  });
}

const leaving = (url: string) => ({ url, preventDefault: vi.fn() });

describe('applySiteRules', () => {
  let contents: FakeContents;

  beforeEach(() => {
    contents = fakeContents();
    applySiteRules(contents as unknown as WebContents);
  });

  it('lets a web page navigate', () => {
    const event = leaving('https://a.com');
    contents.emit('will-navigate', event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it.each(['will-navigate', 'will-redirect'])(
    'blocks anything but the web on %s',
    (name) => {
      const event = leaving('file:///C:/a.txt');
      contents.emit(name, event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
    },
  );

  it('does not let a page block leaving it', () => {
    const event = { preventDefault: vi.fn() };
    contents.emit('will-prevent-unload', event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});

describe('the site viewer', () => {
  let webContents: EventEmitter & {
    loadURL: ReturnType<typeof vi.fn>;
  };
  let window: EventEmitter & {
    show: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.mocked(BrowserWindow).mockClear();
    let url = '';
    webContents = Object.assign(new EventEmitter(), {
      setAudioMuted: vi.fn(),
      getURL: vi.fn(() => url),
      loadURL: vi.fn(async (next: string) => {
        url = next;
      }),
    });
    window = Object.assign(new EventEmitter(), {
      webContents,
      setMenu: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      setTitle: vi.fn(),
    });
    vi.mocked(BrowserWindow).mockImplementation(function fake() {
      return window as unknown as BrowserWindow;
    } as unknown as typeof BrowserWindow);
  });

  it('cannot raise dialogs', () => {
    createSiteViewer({ hidden: vi.fn() }).show('https://a.com');
    expect(vi.mocked(BrowserWindow).mock.calls[0][0]).toMatchObject({
      webPreferences: { disableDialogs: true },
    });
  });

  it('loads and shows the page', () => {
    createSiteViewer({ hidden: vi.fn() }).show('https://a.com');
    expect(webContents.loadURL).toHaveBeenCalledExactlyOnceWith(
      'https://a.com',
    );
    expect(window.show).toHaveBeenCalledOnce();
  });

  it('does not load the same page again when shown again', () => {
    const viewer = createSiteViewer({ hidden: vi.fn() });
    viewer.show('https://a.com');
    viewer.hide();
    viewer.show('https://a.com');
    expect(webContents.loadURL).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
  });

  it('can only show and hide the page, never read it', () => {
    expect(Object.keys(createSiteViewer({ hidden: vi.fn() })).sort()).toEqual([
      'destroy',
      'hide',
      'show',
    ]);
  });

  it('only hides when its X is clicked, and says so', () => {
    const hidden = vi.fn();
    createSiteViewer({ hidden }).show('https://a.com');
    const event = { preventDefault: vi.fn() };
    window.emit('close', event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
    expect(hidden).toHaveBeenCalledOnce();
  });
});
