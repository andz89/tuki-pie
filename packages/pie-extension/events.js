import { isWebAddress } from './protocol.js';

const ABORTED = 'net::ERR_ABORTED';

// Passes on what happens in the tab being checked, main frame only. Other
// kinds of address, like the blank page or Chrome's own pages, never start a
// check, just as in Pie Launcher's hidden window.
export function watchTabs({ chrome, tabs, sendEvent }) {
  const isCheckedPage = async (details) =>
    details.frameId === 0 && details.tabId === (await tabs.checkedTabId());

  // A screenshot as a device may load the page twice. That is the capture,
  // not a new page to check.
  const isCheckedWebPage = async (details) =>
    isWebAddress(details.url) &&
    !tabs.isCapturing() &&
    (await isCheckedPage(details));

  const nav = chrome.webNavigation;

  nav.onCommitted.addListener(async (details) => {
    if (tabs.isCapturing()) {
      return;
    }
    if (await isCheckedWebPage(details)) {
      await tabs.noteCommitted();
      sendEvent('committed');
      return;
    }
    // A new page in the tab you're looking at, which isn't the one checked.
    if (details.frameId === 0 && isWebAddress(details.url)) {
      const tab = await chrome.tabs.get(details.tabId).catch(() => null);
      if (tab?.active) {
        sendEvent('activeTabChanged');
      }
    }
  });

  nav.onCompleted.addListener(async (details) => {
    if (await isCheckedWebPage(details)) {
      sendEvent('loaded');
    }
  });

  const changedInPlace = async (details) => {
    if (await isCheckedWebPage(details)) {
      sendEvent('changedInPlace');
    }
  };
  nav.onHistoryStateUpdated.addListener(changedInPlace);
  nav.onReferenceFragmentUpdated.addListener(changedInPlace);

  nav.onErrorOccurred.addListener(async (details) => {
    if (tabs.isCapturing() || !(await isCheckedPage(details))) {
      return;
    }
    if (details.error !== ABORTED) {
      sendEvent('failed');
      return;
    }
    // Stopped by itself, or replaced by a newer load, which isn't a failure.
    const tab = await chrome.tabs.get(details.tabId).catch(() => null);
    if (tab && tab.status !== 'loading') {
      sendEvent('cancelled');
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => void tabs.tabRemoved(tabId));

  // Switching tabs, or Chrome windows, so Page Info can follow along. Only the
  // fact is sent; Pie Launcher asks for the address itself.
  // A screenshot switches tabs on its own, which isn't you moving on.
  const followSwitch = () => {
    if (!tabs.isCapturing()) {
      sendEvent('activeTabChanged');
    }
  };
  chrome.tabs.onActivated.addListener(followSwitch);
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
      followSwitch();
    }
  });
}
