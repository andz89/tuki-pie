import {
  MAX_OPEN_TABS,
  isWebAddress,
  isWebAddressOrContact,
  sameAddress,
} from './protocol.js';
import { createCapture } from './capture.js';
import { showLinkOnPage } from './show-link.js';

const LINK_SPOTS = ['shown', 'hidden', 'not-found'];

// Chrome reports the capture's last tab switch a moment after it is done.
export const CAPTURE_QUIET_MS = 1000;

// Two tabs matter. `own` is the tab the extension opened and may send to any
// address. `checked` is the tab being read, which may be one of yours: that
// one is never sent elsewhere, reloaded or cleared.
// `committed` says whether the own tab's newest load has arrived yet.
const EMPTY = { own: null, checked: null, committed: false };

// An open tab with this address: the active tab in the window you used last,
// then any active tab, then the one you used most recently. Tabs Chrome put
// to sleep to save memory can't be read, so they're skipped.
export function pickOpenTab(tabs, url, focusedWindowId) {
  const matches = tabs.filter(
    (tab) => !tab.discarded && sameAddress(tab.url, url),
  );
  if (matches.length === 0) {
    return null;
  }
  return (
    matches.find((tab) => tab.active && tab.windowId === focusedWindowId) ??
    matches.find((tab) => tab.active) ??
    matches.reduce((best, tab) =>
      (tab.lastAccessed ?? 0) > (best.lastAccessed ?? 0) ? tab : best,
    )
  );
}

export function createTabs({ chrome, sendEvent }) {
  // Kept in session storage, so it survives the service worker sleeping.
  let saved = null;
  const capturer = createCapture({ chrome });
  let capturing = 0;
  let quietUntil = 0;

  async function ids() {
    if (saved === null) {
      const { pieTabs } = await chrome.storage.session.get('pieTabs');
      saved ??= { ...EMPTY, ...pieTabs };
    }
    return saved;
  }

  async function save(changes) {
    saved = { ...(await ids()), ...changes };
    await chrome.storage.session.set({ pieTabs: saved });
  }

  async function checkedTab() {
    const { checked } = await ids();
    if (checked === null) {
      throw new Error('no-tab');
    }
    return checked;
  }

  // Reads an open tab as it is, without loading it again.
  function readAsIs(tab) {
    sendEvent('committed');
    if (tab.status === 'complete') {
      sendEvent('loaded');
    }
  }

  async function findOpenTab(url) {
    const tabs = await chrome.tabs.query({});
    const focused = await chrome.windows.getLastFocused().catch(() => null);
    return pickOpenTab(tabs, url, focused?.id ?? null);
  }

  // A blank tab first, so its ID is saved before the page can arrive.
  async function ownTab() {
    const { own } = await ids();
    if (own !== null) {
      const tab = await chrome.tabs.get(own).catch(() => null);
      if (tab) {
        return tab.id;
      }
    }
    const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
    await save({ own: tab.id });
    return tab.id;
  }

  async function open(args) {
    const url = args?.url;
    if (!isWebAddress(url)) {
      throw new Error('not-web');
    }
    const found = await findOpenTab(url);
    if (found) {
      await save({ checked: found.id, committed: true });
      readAsIs(found);
      return;
    }
    const own = await ownTab();
    await save({ checked: own, committed: false });
    await chrome.tabs.update(own, { url });
  }

  async function reload() {
    const checked = await checkedTab();
    const { own } = await ids();
    if (checked === own) {
      await save({ committed: false });
      await chrome.tabs.reload(checked);
      return;
    }
    // One of your tabs: read it again, but never reload it.
    readAsIs(await chrome.tabs.get(checked));
  }

  async function stop() {
    const { own, checked, committed } = await ids();
    if (checked === null) {
      return;
    }
    // Nothing arrived yet, so stopping the old page wouldn't stop the new one.
    if (checked === own && !committed) {
      await chrome.tabs.update(own, { url: 'about:blank' });
      return;
    }
    await chrome.scripting
      .executeScript({ target: { tabId: checked }, func: () => window.stop() })
      .catch(() => undefined);
  }

  async function read() {
    const [first] = await chrome.scripting.executeScript({
      target: { tabId: await checkedTab() },
      files: ['collect-page.js'],
    });
    return first?.result ?? null;
  }

  // Focus alone leaves a minimized window on the taskbar, so a minimized one
  // comes back maximized. Any other window keeps the size you gave it.
  async function bringForward(windowId) {
    const window = await chrome.windows.get(windowId);
    await chrome.windows.update(
      windowId,
      window.state === 'minimized'
        ? { state: 'maximized', focused: true }
        : { focused: true },
    );
  }

  async function goToTab() {
    const tab = await chrome.tabs.update(await checkedTab(), { active: true });
    await bringForward(tab.windowId);
  }

  // Brings the checked tab forward, then scrolls to the link and marks it.
  async function showLink(args) {
    const index = args?.index;
    const href = args?.href;
    if (!Number.isInteger(index) || index < 0 || !isWebAddressOrContact(href)) {
      throw new Error('bad-link');
    }
    const tab = await chrome.tabs.update(await checkedTab(), { active: true });
    await bringForward(tab.windowId);
    const [first] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showLinkOnPage,
      args: [index, href],
    });
    const spot = first?.result;
    return LINK_SPOTS.includes(spot) ? spot : 'not-found';
  }

  // Web addresses only, in the background, so you stay where you are.
  async function openTabs(args) {
    const urls = Array.isArray(args?.urls)
      ? [...new Set(args.urls.filter(isWebAddress))].slice(0, MAX_OPEN_TABS)
      : [];
    for (const url of urls) {
      await chrome.tabs.create({ url, active: false });
    }
    return urls.length;
  }

  // A picture of the whole checked page, or { error }.
  // The capture switches tabs itself, which Page Info must not follow.
  // args: { device, reload }, the size picked in the Screenshot tab.
  async function capture(args) {
    const tabId = await checkedTab();
    capturing += 1;
    try {
      return await capturer.capture(tabId, {
        device: typeof args?.device === 'string' ? args.device : '',
        reload: args?.reload === true,
      });
    } finally {
      capturing -= 1;
      quietUntil = Date.now() + CAPTURE_QUIET_MS;
    }
  }

  const isCapturing = () => capturing > 0 || Date.now() < quietUntil;

  async function noteCommitted() {
    await save({ committed: true });
  }

  async function tabRemoved(tabId) {
    const { own, checked } = await ids();
    if (tabId !== own && tabId !== checked) {
      return;
    }
    await save({
      own: own === tabId ? null : own,
      checked: checked === tabId ? null : checked,
    });
    if (tabId === checked) {
      sendEvent('closed');
    }
  }

  const checkedTabId = async () => (await ids()).checked;

  // Only the address of the tab you're looking at, so Page Info can offer to
  // check it. Nothing is read from the page here.
  async function activeTab() {
    const focused = await chrome.windows
      .getLastFocused({ windowTypes: ['normal'] })
      .catch(() => null);
    if (!focused) {
      return null;
    }
    const [tab] = await chrome.tabs.query({
      active: true,
      windowId: focused.id,
    });
    return tab && isWebAddress(tab.url) ? { url: tab.url } : null;
  }

  return {
    open,
    reload,
    stop,
    read,
    goToTab,
    showLink,
    openTabs,
    capture,
    isCapturing,
    noteCommitted,
    tabRemoved,
    checkedTabId,
    activeTab,
  };
}
