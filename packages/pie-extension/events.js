import { isWebAddress } from './protocol.js';

const ABORTED = 'net::ERR_ABORTED';

// Passes on what happens in the tabs being checked, main frame only, each
// with the site that reads it. Other kinds of address, like the blank page or
// Chrome's own pages, never start a check, just as in Pie Launcher's hidden
// window.
export function watchTabs({ chrome, tabs, sendEvent }) {
  const siteOf = async (details) =>
    details.frameId === 0 ? tabs.siteOfTab(details.tabId) : null;

  // A screenshot as a device may load the page twice. That is the capture,
  // not a new page to check.
  const checkedWebPageSite = async (details) =>
    isWebAddress(details.url) && !tabs.isCapturing() ? siteOf(details) : null;

  const nav = chrome.webNavigation;

  nav.onCommitted.addListener(async (details) => {
    const site = await checkedWebPageSite(details);
    if (site !== null) {
      await tabs.noteCommitted(site);
      sendEvent('committed', site);
    }
  });

  nav.onCompleted.addListener(async (details) => {
    const site = await checkedWebPageSite(details);
    if (site !== null) {
      sendEvent('loaded', site);
    }
  });

  const changedInPlace = async (details) => {
    const site = await checkedWebPageSite(details);
    if (site !== null) {
      sendEvent('changedInPlace', site);
    }
  };
  nav.onHistoryStateUpdated.addListener(changedInPlace);
  nav.onReferenceFragmentUpdated.addListener(changedInPlace);

  nav.onErrorOccurred.addListener(async (details) => {
    if (tabs.isCapturing()) {
      return;
    }
    const site = await siteOf(details);
    if (site === null) {
      return;
    }
    if (details.error !== ABORTED) {
      sendEvent('failed', site);
      return;
    }
    // Stopped by itself, or replaced by a newer load, which isn't a failure.
    const tab = await chrome.tabs.get(details.tabId).catch(() => null);
    if (tab && tab.status !== 'loading') {
      sendEvent('cancelled', site);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => void tabs.tabRemoved(tabId));
}
