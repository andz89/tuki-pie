import {
  DEFAULT_SITE,
  MAX_OPEN_TABS,
  isSite,
  isWebAddress,
  isWebAddressOrContact,
  sameAddress,
} from './protocol.js';
import { createCapture } from './capture.js';
import { showLinkOnPage } from './show-link.js';

const LINK_SPOTS = ['shown', 'hidden', 'not-found'];

// Chrome reports the capture's last tab switch a moment after it is done.
export const CAPTURE_QUIET_MS = 1000;

// Each Page Info tab (a "site") has two Chrome tabs that matter. `own` is
// the tab the extension opened for it and may send to any address.
// `checked` is the tab being read, which may be one of yours: that one is
// never sent elsewhere, reloaded, cleared or closed.
// `committed` says whether the own tab's newest load has arrived yet.
const EMPTY = { own: null, checked: null, committed: false };

// An open tab with this address: the active tab in the window you used last,
// then any active tab, then the one you used most recently. Tabs Chrome put
// to sleep to save memory can't be read, so they're skipped.
// Tabs another site already uses are skipped, so two never share one.
export function pickOpenTab(tabs, url, focusedWindowId, taken = new Set()) {
  const matches = tabs.filter(
    (tab) => !tab.discarded && !taken.has(tab.id) && sameAddress(tab.url, url),
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

// The site a request is for: its own id, or the default one.
const siteOf = (args) => (isSite(args?.site) ? args.site : DEFAULT_SITE);

export function createTabs({
  chrome,
  sendEvent,
  capturer = createCapture({ chrome }),
}) {
  // Kept in session storage, so it survives the service worker sleeping.
  // { sites: { [site]: { own, checked, committed } } }
  let saved = null;
  let capturing = 0;
  let quietUntil = 0;

  async function load() {
    if (saved === null) {
      const { pieTabs } = await chrome.storage.session.get('pieTabs');
      saved ??= { sites: { ...pieTabs?.sites } };
    }
    return saved;
  }

  async function ids(site) {
    const { sites } = await load();
    return { ...EMPTY, ...sites[site] };
  }

  // Merged onto what is saved after the wait, not before it: two saves that
  // overlapped would otherwise both start from the same old copy, and the
  // second would undo the first. null drops the site.
  async function save(site, changes) {
    await load();
    const sites = { ...saved.sites };
    if (changes === null) {
      delete sites[site];
    } else {
      sites[site] = { ...EMPTY, ...sites[site], ...changes };
    }
    saved = { sites };
    await chrome.storage.session.set({ pieTabs: saved });
  }

  async function checkedTab(site) {
    const { checked } = await ids(site);
    if (checked === null) {
      throw new Error('no-tab');
    }
    return checked;
  }

  // Reads an open tab as it is, without loading it again.
  function readAsIs(site, tab) {
    sendEvent('committed', site);
    if (tab.status === 'complete') {
      sendEvent('loaded', site);
    }
  }

  // Every tab the other sites use.
  async function takenByOthers(site) {
    const { sites } = await load();
    const taken = new Set();
    for (const [other, { own, checked }] of Object.entries(sites)) {
      if (other !== site) {
        taken.add(own);
        taken.add(checked);
      }
    }
    taken.delete(null);
    taken.delete(undefined);
    return taken;
  }

  async function findOpenTab(site, url) {
    const tabs = await chrome.tabs.query({});
    const focused = await chrome.windows.getLastFocused().catch(() => null);
    return pickOpenTab(
      tabs,
      url,
      focused?.id ?? null,
      await takenByOthers(site),
    );
  }

  // A blank tab first, so its ID is saved before the page can arrive.
  async function ownTab(site) {
    const { own } = await ids(site);
    if (own !== null) {
      const tab = await chrome.tabs.get(own).catch(() => null);
      if (tab) {
        return tab.id;
      }
    }
    const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
    await save(site, { own: tab.id });
    return tab.id;
  }

  async function open(args) {
    const site = siteOf(args);
    const url = args?.url;
    if (!isWebAddress(url)) {
      throw new Error('not-web');
    }
    const found = await findOpenTab(site, url);
    if (found) {
      await save(site, { checked: found.id, committed: true });
      readAsIs(site, found);
      return;
    }
    const own = await ownTab(site);
    await save(site, { checked: own, committed: false });
    await chrome.tabs.update(own, { url });
  }

  async function reload(args) {
    const site = siteOf(args);
    const checked = await checkedTab(site);
    const { own } = await ids(site);
    if (checked === own) {
      await save(site, { committed: false });
      await chrome.tabs.reload(checked);
      return;
    }
    // One of your tabs: read it again, but never reload it.
    readAsIs(site, await chrome.tabs.get(checked));
  }

  async function stop(args) {
    const site = siteOf(args);
    const { own, checked, committed } = await ids(site);
    if (checked === null) {
      return;
    }
    // One of your tabs is never stopped: a half-filled form would be lost.
    if (checked !== own) {
      return;
    }
    // Nothing arrived yet, so stopping the old page wouldn't stop the new one.
    if (!committed) {
      await chrome.tabs.update(own, { url: 'about:blank' });
      return;
    }
    await chrome.scripting
      .executeScript({ target: { tabId: checked }, func: () => window.stop() })
      .catch(() => undefined);
  }

  async function read(args) {
    const [first] = await chrome.scripting.executeScript({
      target: { tabId: await checkedTab(siteOf(args)) },
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

  async function goToTab(args) {
    const tab = await chrome.tabs.update(await checkedTab(siteOf(args)), {
      active: true,
    });
    await bringForward(tab.windowId);
  }

  // Brings the checked tab forward, then scrolls to the link and marks it.
  async function showLink(args) {
    const index = args?.index;
    const href = args?.href;
    if (!Number.isInteger(index) || index < 0 || !isWebAddressOrContact(href)) {
      throw new Error('bad-link');
    }
    const tab = await chrome.tabs.update(await checkedTab(siteOf(args)), {
      active: true,
    });
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

  // A picture of the whole checked page, or of one section, or { error }.
  // The capture switches tabs itself, which must not count as a new page.
  // args: { site, device, reload, section }, as picked in the Screenshot tab.
  // section: a CSS selector, or empty for the whole page.
  // Only its own tab is reloaded for a device. One of yours is taken as it
  // is, since reloading it could lose what you typed.
  async function capture(args) {
    const site = siteOf(args);
    const tabId = await checkedTab(site);
    const { own } = await ids(site);
    capturing += 1;
    try {
      return await capturer.capture(tabId, {
        device: typeof args?.device === 'string' ? args.device : '',
        reload: args?.reload === true && tabId === own,
        selector: typeof args?.section === 'string' ? args.section : '',
      });
    } finally {
      capturing -= 1;
      quietUntil = Date.now() + CAPTURE_QUIET_MS;
    }
  }

  // The Page Info tab was closed: the Chrome tab opened for it goes too.
  // One of your tabs stays open.
  async function forget(args) {
    const site = siteOf(args);
    const { own } = await ids(site);
    await save(site, null);
    if (own !== null) {
      await chrome.tabs.remove(own).catch(() => undefined);
    }
  }

  const isCapturing = () => capturing > 0 || Date.now() < quietUntil;

  // A site's requests run one after another: a tab closed while its page
  // was still opening would otherwise leave a Chrome tab behind.
  const queues = new Map();
  function inTurn(args, run) {
    const site = siteOf(args);
    const previous = queues.get(site) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => run(args));
    queues.set(site, next);
    return next.finally(() => {
      if (queues.get(site) === next) {
        queues.delete(site);
      }
    });
  }

  async function noteCommitted(site) {
    await save(site, { committed: true });
  }

  async function tabRemoved(tabId) {
    const { sites } = await load();
    for (const [site, { own, checked }] of Object.entries(sites)) {
      if (tabId !== own && tabId !== checked) {
        continue;
      }
      await save(site, {
        own: own === tabId ? null : own,
        checked: checked === tabId ? null : checked,
      });
      if (tabId === checked) {
        sendEvent('closed', site);
      }
    }
  }

  // The site that reads this tab, or null.
  async function siteOfTab(tabId) {
    const { sites } = await load();
    const found = Object.entries(sites).find(
      ([, { checked }]) => checked === tabId,
    );
    return found ? found[0] : null;
  }

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
    open: (args) => inTurn(args, open),
    reload: (args) => inTurn(args, reload),
    stop: (args) => inTurn(args, stop),
    read,
    goToTab,
    showLink,
    openTabs,
    capture,
    forget: (args) => inTurn(args, forget),
    isCapturing,
    noteCommitted,
    tabRemoved,
    siteOfTab,
    activeTab,
  };
}
