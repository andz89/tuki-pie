import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_QUIET_MS, createTabs, pickOpenTab } from './tabs.js';

interface FakeTab {
  id: number;
  url: string;
  status?: string;
  active?: boolean;
  windowId?: number;
  lastAccessed?: number;
  discarded?: boolean;
}

let openTabs: FakeTab[];
let session: Record<string, unknown>;
let sendEvent: ReturnType<typeof vi.fn>;
let nextId: number;

function fakeChrome() {
  return {
    storage: {
      session: {
        get: vi.fn(async (key: string) => ({ [key]: session[key] })),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(session, values);
        }),
      },
    },
    tabs: {
      query: vi.fn(async (filter: Partial<FakeTab> = {}) =>
        openTabs.filter((tab) =>
          Object.entries(filter).every(
            ([key, value]) => tab[key as keyof FakeTab] === value,
          ),
        ),
      ),
      get: vi.fn(async (id: number) => {
        const tab = openTabs.find((each) => each.id === id);
        if (!tab) throw new Error('No tab');
        return tab;
      }),
      create: vi.fn(async ({ url }: { url: string }) => {
        const tab = { id: nextId++, url, status: 'complete', windowId: 1 };
        openTabs.push(tab);
        return tab;
      }),
      update: vi.fn(async (id: number, changes: Partial<FakeTab>) => {
        const tab = openTabs.find((each) => each.id === id);
        if (!tab) throw new Error('No tab');
        Object.assign(tab, changes);
        return tab;
      }),
      reload: vi.fn(async () => undefined),
    },
    windows: {
      getLastFocused: vi.fn(async () => ({ id: 1 })),
      get: vi.fn(async (id: number) => ({ id, state: 'normal' })),
      update: vi.fn(async () => undefined),
    },
    scripting: {
      executeScript: vi.fn(async () => [{ result: { url: 'x' } }]),
    },
  };
}

let chrome: ReturnType<typeof fakeChrome>;
let tabs: ReturnType<typeof createTabs>;

beforeEach(() => {
  openTabs = [];
  session = {};
  nextId = 100;
  sendEvent = vi.fn();
  chrome = fakeChrome();
  tabs = createTabs({ chrome, sendEvent });
});

describe('pickOpenTab', () => {
  const tab = (changes: Partial<FakeTab>): FakeTab => ({
    id: 1,
    url: 'https://a.com/',
    windowId: 1,
    ...changes,
  });

  it('prefers the active tab in the window used last', () => {
    const picked = pickOpenTab(
      [
        tab({ id: 1, active: true, windowId: 2, lastAccessed: 9 }),
        tab({ id: 2, active: true, windowId: 1 }),
      ],
      'https://a.com',
      1,
    );
    expect(picked?.id).toBe(2);
  });

  it('then any active tab', () => {
    const picked = pickOpenTab(
      [
        tab({ id: 1, lastAccessed: 9 }),
        tab({ id: 2, active: true, windowId: 3 }),
      ],
      'https://a.com',
      1,
    );
    expect(picked?.id).toBe(2);
  });

  it('then the one used most recently', () => {
    const picked = pickOpenTab(
      [tab({ id: 1, lastAccessed: 5 }), tab({ id: 2, lastAccessed: 9 })],
      'https://a.com',
      1,
    );
    expect(picked?.id).toBe(2);
  });

  it('skips tabs Chrome put to sleep', () => {
    expect(
      pickOpenTab([tab({ discarded: true, active: true })], 'https://a.com', 1),
    ).toBeNull();
  });

  it('matches a different # part', () => {
    expect(
      pickOpenTab([tab({ url: 'https://a.com/#top' })], 'https://a.com', 1)?.id,
    ).toBe(1);
  });
});

describe('opening an address', () => {
  it('refuses anything but http and https', async () => {
    await expect(tabs.open({ url: 'javascript:alert(1)' })).rejects.toThrow();
    await expect(tabs.open({ url: 'file:///c:/x' })).rejects.toThrow();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('reads an open, loaded tab as it is', async () => {
    openTabs = [
      { id: 7, url: 'https://a.com/', status: 'complete', active: true },
    ];
    await tabs.open({ url: 'https://a.com' });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
    expect(sendEvent.mock.calls).toEqual([['committed'], ['loaded']]);
    expect(await tabs.checkedTabId()).toBe(7);
  });

  it('waits for an open tab that is still loading', async () => {
    openTabs = [{ id: 7, url: 'https://a.com/', status: 'loading' }];
    await tabs.open({ url: 'https://a.com' });
    expect(sendEvent.mock.calls).toEqual([['committed']]);
  });

  it('opens a blank background tab first, then the address', async () => {
    await tabs.open({ url: 'https://a.com' });
    expect(chrome.tabs.create).toHaveBeenCalledExactlyOnceWith({
      url: 'about:blank',
      active: false,
    });
    expect(chrome.tabs.update).toHaveBeenCalledExactlyOnceWith(100, {
      url: 'https://a.com',
    });
    expect(await tabs.checkedTabId()).toBe(100);
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('reuses its own tab for the next address', async () => {
    await tabs.open({ url: 'https://a.com' });
    await tabs.open({ url: 'https://b.com' });
    expect(chrome.tabs.create).toHaveBeenCalledOnce();
    expect(chrome.tabs.update).toHaveBeenLastCalledWith(100, {
      url: 'https://b.com',
    });
  });

  it('makes a new tab if its own was closed', async () => {
    await tabs.open({ url: 'https://a.com' });
    openTabs = [];
    await tabs.tabRemoved(100);
    await tabs.open({ url: 'https://b.com' });
    expect(chrome.tabs.create).toHaveBeenCalledTimes(2);
  });

  it('never sends one of your tabs to another address', async () => {
    openTabs = [{ id: 7, url: 'https://a.com/', status: 'complete' }];
    await tabs.open({ url: 'https://a.com' });
    await tabs.open({ url: 'https://b.com' });
    expect(chrome.tabs.update).not.toHaveBeenCalledWith(7, expect.anything());
    expect(await tabs.checkedTabId()).toBe(100);
  });

  it('survives the service worker sleeping', async () => {
    await tabs.open({ url: 'https://a.com' });
    const woken = createTabs({ chrome, sendEvent });
    expect(await woken.checkedTabId()).toBe(100);
  });
});

describe('refresh', () => {
  it('reloads its own tab', async () => {
    await tabs.open({ url: 'https://a.com' });
    await tabs.reload();
    expect(chrome.tabs.reload).toHaveBeenCalledExactlyOnceWith(100);
  });

  it('reads one of your tabs again without reloading it', async () => {
    openTabs = [{ id: 7, url: 'https://a.com/', status: 'complete' }];
    await tabs.open({ url: 'https://a.com' });
    sendEvent.mockClear();
    await tabs.reload();
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
    expect(sendEvent.mock.calls).toEqual([['committed'], ['loaded']]);
  });
});

describe('stop', () => {
  it('clears its own tab if nothing has arrived yet', async () => {
    await tabs.open({ url: 'https://a.com' });
    await tabs.stop();
    expect(chrome.tabs.update).toHaveBeenLastCalledWith(100, {
      url: 'about:blank',
    });
  });

  it('stops its own tab in place once the page has arrived', async () => {
    await tabs.open({ url: 'https://a.com' });
    await tabs.noteCommitted();
    await tabs.stop();
    expect(chrome.tabs.update).not.toHaveBeenCalledWith(100, {
      url: 'about:blank',
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledOnce();
  });

  it('never clears or stops one of your tabs', async () => {
    openTabs = [{ id: 7, url: 'https://a.com/', status: 'loading' }];
    await tabs.open({ url: 'https://a.com' });
    await tabs.stop();
    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });
});

describe('reading and going to the tab', () => {
  it('runs the reader file in the checked tab', async () => {
    openTabs = [{ id: 7, url: 'https://a.com/', status: 'complete' }];
    await tabs.open({ url: 'https://a.com' });
    await expect(tabs.read()).resolves.toEqual({ url: 'x' });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['collect-page.js'],
    });
  });

  it('fails to read with no tab', async () => {
    await expect(tabs.read()).rejects.toThrow();
  });

  it('activates the tab and focuses its window', async () => {
    openTabs = [
      { id: 7, url: 'https://a.com/', status: 'complete', windowId: 4 },
    ];
    await tabs.open({ url: 'https://a.com' });
    await tabs.goToTab();
    expect(chrome.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(chrome.windows.update).toHaveBeenCalledWith(4, { focused: true });
  });

  it('maximizes a minimized window when going to the tab', async () => {
    openTabs = [
      { id: 7, url: 'https://a.com/', status: 'complete', windowId: 4 },
    ];
    chrome.windows.get.mockResolvedValueOnce({ id: 4, state: 'minimized' });
    await tabs.open({ url: 'https://a.com' });
    await tabs.goToTab();
    expect(chrome.windows.update).toHaveBeenCalledWith(4, {
      state: 'maximized',
      focused: true,
    });
  });
});

describe('links', () => {
  beforeEach(async () => {
    openTabs = [
      { id: 7, url: 'https://a.com/', status: 'complete', windowId: 4 },
    ];
    await tabs.open({ url: 'https://a.com' });
  });

  it('brings the tab forward and marks the link', async () => {
    chrome.scripting.executeScript.mockResolvedValueOnce([{ result: 'shown' }]);
    await expect(
      tabs.showLink({ index: 3, href: 'https://a.com/x' }),
    ).resolves.toBe('shown');
    expect(chrome.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(chrome.windows.update).toHaveBeenCalledWith(4, { focused: true });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 7 },
        args: [3, 'https://a.com/x'],
      }),
    );
  });

  it('turns an odd page answer into not-found', async () => {
    await expect(
      tabs.showLink({ index: 0, href: 'https://a.com/x' }),
    ).resolves.toBe('not-found');
  });

  it('refuses a bad link', async () => {
    await expect(
      tabs.showLink({ index: -1, href: 'https://a.com/x' }),
    ).rejects.toThrow();
    await expect(
      tabs.showLink({ index: 0, href: 'javascript:alert(1)' }),
    ).rejects.toThrow();
  });

  it('opens web links once each in background tabs', async () => {
    chrome.tabs.create.mockClear();
    await expect(
      tabs.openTabs({
        urls: ['https://b.com/', 'mailto:x@b.com', 'https://b.com/'],
      }),
    ).resolves.toBe(1);
    expect(chrome.tabs.create).toHaveBeenCalledExactlyOnceWith({
      url: 'https://b.com/',
      active: false,
    });
  });
});

describe('saving which tabs matter', () => {
  it('keeps both of two changes saved at the same moment', async () => {
    // Own tab 100 is checked, and tab 7 is open too.
    await tabs.open({ url: 'https://a.com' });
    openTabs.push({ id: 7, url: 'https://b.com/', status: 'complete' });
    // A fresh worker, as after the service worker slept.
    tabs = createTabs({ chrome, sendEvent });
    await Promise.all([tabs.noteCommitted(), tabs.tabRemoved(100)]);
    expect(session.pieTabs).toMatchObject({
      own: null,
      checked: null,
      committed: true,
    });
  });
});

describe('closing tabs', () => {
  it('reports the checked tab closing', async () => {
    openTabs = [{ id: 7, url: 'https://a.com/', status: 'complete' }];
    await tabs.open({ url: 'https://a.com' });
    sendEvent.mockClear();
    await tabs.tabRemoved(7);
    expect(sendEvent).toHaveBeenCalledExactlyOnceWith('closed');
    expect(await tabs.checkedTabId()).toBeNull();
  });

  it('ignores other tabs closing', async () => {
    openTabs = [{ id: 7, url: 'https://a.com/', status: 'complete' }];
    await tabs.open({ url: 'https://a.com' });
    sendEvent.mockClear();
    await tabs.tabRemoved(8);
    expect(sendEvent).not.toHaveBeenCalled();
  });
});

describe('the active tab', () => {
  it('gives only the address of the active tab in the window used last', async () => {
    openTabs = [
      { id: 1, url: 'https://a.com/', active: true, windowId: 2 },
      { id: 2, url: 'https://b.com/', active: true, windowId: 1 },
      { id: 3, url: 'https://c.com/', active: false, windowId: 1 },
    ];
    await expect(tabs.activeTab()).resolves.toEqual({ url: 'https://b.com/' });
    expect(chrome.windows.getLastFocused).toHaveBeenCalledWith({
      windowTypes: ['normal'],
    });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('gives nothing for a page that is not a website', async () => {
    openTabs = [{ id: 2, url: 'chrome://newtab/', active: true, windowId: 1 }];
    await expect(tabs.activeTab()).resolves.toBeNull();
  });

  it('gives nothing with no Chrome window', async () => {
    chrome.windows.getLastFocused.mockRejectedValueOnce(new Error('none'));
    await expect(tabs.activeTab()).resolves.toBeNull();
  });

  it('then reads that same tab as it is', async () => {
    openTabs = [
      {
        id: 2,
        url: 'https://b.com/',
        active: true,
        windowId: 1,
        status: 'complete',
      },
    ];
    const { url } = (await tabs.activeTab()) as { url: string };
    await tabs.open({ url });
    expect(await tabs.checkedTabId()).toBe(2);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });
});

describe('capture', () => {
  function withFakeCapturer() {
    const capturer = { capture: vi.fn(async () => ({ dataUrl: 'x' })) };
    tabs = createTabs({ chrome, sendEvent, capturer });
    return capturer;
  }

  it('reloads its own tab as the device when asked', async () => {
    const capturer = withFakeCapturer();
    await tabs.open({ url: 'https://a.com' });
    await tabs.capture({ device: 'Pixel 9', reload: true });
    expect(capturer.capture).toHaveBeenCalledWith(100, {
      device: 'Pixel 9',
      reload: true,
      selector: '',
    });
  });

  it('passes the section on as a selector', async () => {
    const capturer = withFakeCapturer();
    await tabs.open({ url: 'https://a.com' });
    await tabs.capture({ device: '', reload: false, section: '#hero' });
    expect(capturer.capture).toHaveBeenCalledWith(100, {
      device: '',
      reload: false,
      selector: '#hero',
    });
  });

  it('never reloads one of your tabs, even when asked', async () => {
    const capturer = withFakeCapturer();
    openTabs = [{ id: 7, url: 'https://a.com/', status: 'complete' }];
    await tabs.open({ url: 'https://a.com' });
    await tabs.capture({ device: 'Pixel 9', reload: true });
    expect(capturer.capture).toHaveBeenCalledWith(7, {
      device: 'Pixel 9',
      reload: false,
      selector: '',
    });
  });

  it('needs a checked tab', async () => {
    await expect(tabs.capture()).rejects.toThrow('no-tab');
  });

  it('counts as capturing until a moment after it ends', async () => {
    openTabs.push({ id: 5, url: 'https://a.com/', status: 'complete' });
    await tabs.open({ url: 'https://a.com/' });
    // Chrome refuses the page, so the capture ends at once.
    chrome.scripting.executeScript.mockRejectedValue(new Error('refused'));
    await expect(tabs.capture()).resolves.toMatchObject({
      error: 'not-allowed',
    });
    expect(tabs.isCapturing()).toBe(true);
    const later = Date.now() + CAPTURE_QUIET_MS + 1;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    expect(tabs.isCapturing()).toBe(false);
    vi.restoreAllMocks();
  });
});
