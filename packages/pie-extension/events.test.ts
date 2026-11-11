import { beforeEach, describe, expect, it, vi } from 'vitest';
import { watchTabs } from './events.js';

type Listener = (details: Record<string, unknown>) => Promise<void> | void;

const listeners: Record<string, Listener> = {};
const event = (name: string) => ({
  addListener: (listener: Listener) => {
    listeners[name] = listener;
  },
});

let tabStatus: string;
let tabActive: boolean;
let sendEvent: ReturnType<typeof vi.fn>;
let tabs: {
  checkedTabId: ReturnType<typeof vi.fn>;
  noteCommitted: ReturnType<typeof vi.fn>;
  tabRemoved: ReturnType<typeof vi.fn>;
  isCapturing: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  tabStatus = 'complete';
  tabActive = false;
  sendEvent = vi.fn();
  tabs = {
    checkedTabId: vi.fn(async () => 7),
    noteCommitted: vi.fn(async () => undefined),
    tabRemoved: vi.fn(async () => undefined),
    isCapturing: vi.fn(() => false),
  };
  const chrome = {
    webNavigation: {
      onCommitted: event('committed'),
      onCompleted: event('completed'),
      onHistoryStateUpdated: event('history'),
      onReferenceFragmentUpdated: event('fragment'),
      onErrorOccurred: event('error'),
    },
    tabs: {
      get: vi.fn(async () => ({ status: tabStatus, active: tabActive })),
      onRemoved: event('removed'),
      onActivated: event('activated'),
    },
    windows: {
      WINDOW_ID_NONE: -1,
      onFocusChanged: event('focus'),
    },
  };
  watchTabs({ chrome, tabs, sendEvent });
});

const page = { tabId: 7, frameId: 0, url: 'https://a.com/' };

describe('tab events', () => {
  it('passes on a new page in the checked tab', async () => {
    await listeners.committed(page);
    expect(sendEvent).toHaveBeenCalledExactlyOnceWith('committed');
    expect(tabs.noteCommitted).toHaveBeenCalledOnce();
  });

  it('passes on a finished load and in-place changes', async () => {
    await listeners.completed(page);
    await listeners.history(page);
    await listeners.fragment(page);
    expect(sendEvent.mock.calls).toEqual([
      ['loaded'],
      ['changedInPlace'],
      ['changedInPlace'],
    ]);
  });

  it('ignores other tabs', async () => {
    await listeners.committed({ ...page, tabId: 8 });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('ignores frames inside the page', async () => {
    await listeners.committed({ ...page, frameId: 3 });
    await listeners.completed({ ...page, frameId: 3 });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it.each(['about:blank', 'chrome://settings/', 'file:///c:/x'])(
    'ignores %s',
    async (url) => {
      await listeners.committed({ ...page, url });
      await listeners.completed({ ...page, url });
      expect(sendEvent).not.toHaveBeenCalled();
    },
  );

  it('reports a failed load', async () => {
    await listeners.error({ ...page, error: 'net::ERR_NAME_NOT_RESOLVED' });
    expect(sendEvent).toHaveBeenCalledExactlyOnceWith('failed');
  });

  it('reports a load you stopped as cancelled', async () => {
    tabStatus = 'complete';
    await listeners.error({ ...page, error: 'net::ERR_ABORTED' });
    expect(sendEvent).toHaveBeenCalledExactlyOnceWith('cancelled');
  });

  it('stays quiet when a newer load replaced the old one', async () => {
    tabStatus = 'loading';
    await listeners.error({ ...page, error: 'net::ERR_ABORTED' });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('passes closed tabs to the tab list', () => {
    listeners.removed(7 as unknown as Record<string, unknown>);
    expect(tabs.tabRemoved).toHaveBeenCalledWith(7);
  });

  it('says when you switch tabs or Chrome windows', () => {
    listeners.activated({ tabId: 3, windowId: 1 });
    listeners.focus(2 as unknown as Record<string, unknown>);
    expect(sendEvent.mock.calls).toEqual([
      ['activeTabChanged'],
      ['activeTabChanged'],
    ]);
  });

  it('ignores the tab switches a screenshot makes', () => {
    tabs.isCapturing.mockReturnValue(true);
    listeners.activated({ tabId: 3, windowId: 1 });
    listeners.focus(2 as unknown as Record<string, unknown>);
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('ignores the loads a screenshot as a device makes', async () => {
    tabs.isCapturing.mockReturnValue(true);
    tabActive = true;
    await listeners.committed(page);
    await listeners.committed({ ...page, tabId: 8 });
    await listeners.completed(page);
    await listeners.history(page);
    await listeners.error({ ...page, error: 'net::ERR_ABORTED' });
    expect(sendEvent).not.toHaveBeenCalled();
    expect(tabs.noteCommitted).not.toHaveBeenCalled();
  });

  it('stays quiet when Chrome loses focus', () => {
    listeners.focus(-1 as unknown as Record<string, unknown>);
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('says when the tab you are looking at gets a new page', async () => {
    tabActive = true;
    await listeners.committed({ ...page, tabId: 8 });
    expect(sendEvent).toHaveBeenCalledExactlyOnceWith('activeTabChanged');
  });
});
