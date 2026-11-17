import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActiveTab } from './active-tab.js';

type Listener = (...args: unknown[]) => unknown;

let listeners: Record<string, Listener>;
let sendEvent: ReturnType<typeof vi.fn>;
let activeTabs: Array<{ id: number; url: string }>;
let focused: { id: number } | null;

const event = (name: string) => ({
  addListener: (listener: Listener) => {
    listeners[name] = listener;
  },
});

function fakeChrome() {
  return {
    windows: {
      WINDOW_ID_NONE: -1,
      getLastFocused: vi.fn(async () => focused),
      onFocusChanged: event('focus'),
    },
    tabs: {
      query: vi.fn(async () => activeTabs),
      onActivated: event('activated'),
      onUpdated: event('updated'),
    },
    scripting: {
      executeScript: vi.fn(async () => [{ result: { url: 'page' } }]),
    },
  };
}

let chrome: ReturnType<typeof fakeChrome>;

beforeEach(() => {
  listeners = {};
  sendEvent = vi.fn();
  activeTabs = [{ id: 5, url: 'https://a.com/' }];
  focused = { id: 1 };
  chrome = fakeChrome();
});

describe('reading the active tab', () => {
  it('reads the page in the active tab', async () => {
    const { readActive } = createActiveTab({ chrome, sendEvent });
    await expect(readActive()).resolves.toEqual({
      url: 'https://a.com/',
      page: { url: 'page' },
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 5 },
      files: ['collect-page.js'],
    });
  });

  it('reads nothing from a tab without a web page', async () => {
    activeTabs = [{ id: 5, url: 'chrome://newtab/' }];
    const { readActive } = createActiveTab({ chrome, sendEvent });
    await expect(readActive()).resolves.toBeNull();
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('reads nothing without a Chrome window', async () => {
    focused = null;
    const { readActive } = createActiveTab({ chrome, sendEvent });
    await expect(readActive()).resolves.toBeNull();
  });
});

describe('showing a link in the tab in front', () => {
  it('shows the link while the tab still shows the card page', async () => {
    chrome.scripting.executeScript.mockResolvedValueOnce([
      { result: 'shown' },
    ] as never);
    const { showActiveLink } = createActiveTab({ chrome, sendEvent });
    await expect(
      showActiveLink({
        index: 2,
        href: 'https://b.com/',
        url: 'https://a.com/',
      }),
    ).resolves.toBe('shown');
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 5 },
        args: [2, 'https://b.com/'],
      }),
    );
  });

  it('looks for nothing once the tab shows another page', async () => {
    const { showActiveLink } = createActiveTab({ chrome, sendEvent });
    await expect(
      showActiveLink({
        index: 2,
        href: 'https://b.com/',
        url: 'https://c.com/',
      }),
    ).resolves.toBe('not-found');
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('refuses a link that is not an address', async () => {
    const { showActiveLink } = createActiveTab({ chrome, sendEvent });
    await expect(
      showActiveLink({
        index: 2,
        href: 'javascript:alert(1)',
        url: 'https://a.com/',
      }),
    ).rejects.toThrow('bad-link');
  });
});

describe('highlighting words in the tab in front', () => {
  it('loads mark.js the first time, then marks the words', async () => {
    chrome.scripting.executeScript
      .mockResolvedValueOnce([{ result: -1 }] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ result: 3 }] as never);
    const { highlightActive } = createActiveTab({ chrome, sendEvent });
    await expect(
      highlightActive({ words: ['price', ''], url: 'https://a.com/' }),
    ).resolves.toBe(3);
    expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ args: [['price']] }),
    );
    expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(2, {
      target: { tabId: 5 },
      files: ['vendor/mark.min.js'],
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(3);
  });

  it('does not load mark.js again while the page has it', async () => {
    chrome.scripting.executeScript.mockResolvedValueOnce([
      { result: 2 },
    ] as never);
    const { highlightActive } = createActiveTab({ chrome, sendEvent });
    await expect(
      highlightActive({ words: ['price'], url: 'https://a.com/' }),
    ).resolves.toBe(2);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
  });

  it('does not load mark.js just to clear a page never marked', async () => {
    chrome.scripting.executeScript.mockResolvedValueOnce([
      { result: -1 },
    ] as never);
    const { highlightActive } = createActiveTab({ chrome, sendEvent });
    await expect(
      highlightActive({ words: [], url: 'https://a.com/' }),
    ).resolves.toBe(0);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
  });

  it('marks nothing once the tab shows another page', async () => {
    const { highlightActive } = createActiveTab({ chrome, sendEvent });
    await expect(
      highlightActive({ words: ['price'], url: 'https://c.com/' }),
    ).resolves.toBe(0);
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });
});

describe('taking marks off a tab you left', () => {
  it('clears the old tab once another tab is read', async () => {
    chrome.scripting.executeScript.mockResolvedValueOnce([
      { result: 2 },
    ] as never);
    const activeTab = createActiveTab({ chrome, sendEvent });
    await activeTab.highlightActive({
      words: ['price'],
      url: 'https://a.com/',
    });
    activeTabs = [{ id: 6, url: 'https://b.com/' }];
    chrome.scripting.executeScript.mockClear();
    await activeTab.readActive();
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 5 }, args: [[]] }),
    );
  });

  it('clears the old tab when the card closes on another tab', async () => {
    chrome.scripting.executeScript.mockResolvedValueOnce([
      { result: 2 },
    ] as never);
    const activeTab = createActiveTab({ chrome, sendEvent });
    await activeTab.highlightActive({
      words: ['price'],
      url: 'https://a.com/',
    });
    activeTabs = [{ id: 6, url: 'https://b.com/' }];
    chrome.scripting.executeScript.mockClear();
    await expect(
      activeTab.highlightActive({ words: [], url: 'https://a.com/' }),
    ).resolves.toBe(0);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 5 }, args: [[]] }),
    );
  });

  it('leaves the tab alone while it is still the one marked', async () => {
    chrome.scripting.executeScript.mockResolvedValueOnce([
      { result: 2 },
    ] as never);
    const activeTab = createActiveTab({ chrome, sendEvent });
    await activeTab.highlightActive({
      words: ['price'],
      url: 'https://a.com/',
    });
    chrome.scripting.executeScript.mockClear();
    await activeTab.readActive();
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['collect-page.js'] }),
    );
  });
});

describe('active tab changes', () => {
  let activeTab: ReturnType<typeof createActiveTab>;
  beforeEach(() => {
    activeTab = createActiveTab({ chrome, sendEvent });
    activeTab.watch();
  });

  it('tells Pie Launcher when another tab comes forward', () => {
    listeners.activated({ tabId: 3 });
    expect(sendEvent.mock.calls).toEqual([['activeTabChanged', 'active-tab']]);
  });

  it('tells Pie Launcher when another window brings another tab forward', async () => {
    await listeners.focus(2);
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      windowId: 2,
    });
    expect(sendEvent).toHaveBeenCalledTimes(1);
  });

  it('ignores focus coming back to the tab already on the card', async () => {
    await activeTab.readActive();
    await listeners.focus(1);
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('ignores focus leaving Chrome', () => {
    listeners.focus(-1);
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('tells only about the tab in front loading or moving', () => {
    listeners.updated(3, { status: 'complete' }, { active: true });
    listeners.updated(3, { url: 'https://b.com/' }, { active: true });
    listeners.updated(4, { status: 'complete' }, { active: false });
    listeners.updated(3, { status: 'loading' }, { active: true });
    expect(sendEvent).toHaveBeenCalledTimes(2);
  });
});
