import {
  ACTIVE_TAB_SITE,
  isWebAddress,
  isWebAddressOrContact,
  sameAddress,
} from './protocol.js';
import { highlightWordsOnPage } from './highlight.js';
import { showLinkOnPage } from './show-link.js';

const LINK_SPOTS = ['shown', 'hidden', 'not-found'];
// What one highlight may ask for, so a request stays small.
const MAX_HIGHLIGHT_WORDS = 10;
const MAX_HIGHLIGHT_LENGTH = 100;

// The tab you are looking at, for Pie Launcher's Info Card. The page is read
// only when Pie Launcher asks, and it asks only while the card is open.
export function createActiveTab({ chrome, sendEvent }) {
  // The tab last read for the card. Clicking back into Chrome from the card
  // brings the same tab forward; reading it again would wipe the Links
  // card's ticks and scroll the page to the highlight. Forgotten when the
  // worker sleeps, which only costs one extra read.
  let lastRead = null;
  // The tab the highlight field last marked. Once another tab is on the
  // card, its marks are taken off, so a tab you left is not left yellow.
  // Only Pie Launcher's own marks are removed; nothing is read.
  let markedTab = null;

  async function clearMarks(keepTabId) {
    if (markedTab === null || markedTab === keepTabId) {
      return;
    }
    const tabId = markedTab;
    markedTab = null;
    // The tab may be closed, or show a page scripts can't run in.
    await chrome.scripting
      .executeScript({
        target: { tabId },
        func: highlightWordsOnPage,
        args: [[]],
      })
      .catch(() => undefined);
  }

  async function find() {
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
    return tab && isWebAddress(tab.url) ? tab : null;
  }

  // { url, page } for a web page, or null for a new tab, chrome:// page and
  // the like.
  async function readActive() {
    const tab = await find();
    lastRead = tab?.id ?? null;
    void clearMarks(lastRead);
    if (!tab) {
      return null;
    }
    const [first] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['collect-page.js'],
    });
    return { url: tab.url, page: first?.result ?? null };
  }

  // For the Links card: scroll to one link in the tab in front and outline
  // it, as Web Page does. Only while that tab still shows the card's page
  // (url), so a link is never looked for on another page. Chrome is not
  // brought forward: it already is while the card shows.
  async function showActiveLink(args) {
    const index = args?.index;
    const href = args?.href;
    if (!Number.isInteger(index) || index < 0 || !isWebAddressOrContact(href)) {
      throw new Error('bad-link');
    }
    const tab = await find();
    if (
      !tab ||
      typeof args?.url !== 'string' ||
      !sameAddress(tab.url, args.url)
    ) {
      return 'not-found';
    }
    const [first] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showLinkOnPage,
      args: [index, href],
    });
    const spot = first?.result;
    return LINK_SPOTS.includes(spot) ? spot : 'not-found';
  }

  // For the Links card's highlight field: marks words in the text of the
  // tab in front with mark.js, only while it shows the card's page (url).
  // No words clears the marks. Answers how many places were marked.
  async function highlightActive(args) {
    const words = Array.isArray(args?.words)
      ? args.words
          .filter((word) => typeof word === 'string' && word !== '')
          .slice(0, MAX_HIGHLIGHT_WORDS)
          .map((word) => word.slice(0, MAX_HIGHLIGHT_LENGTH))
      : [];
    const found = await find();
    const tab =
      found && typeof args?.url === 'string' && sameAddress(found.url, args.url)
        ? found
        : null;
    await clearMarks(tab?.id ?? null);
    if (!tab) {
      return 0;
    }
    // mark.js stays in the page once loaded, so it is sent only the first
    // time, or after the page reloaded.
    const mark = () =>
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: highlightWordsOnPage,
        args: [words],
      });
    let [first] = await mark();
    if (first?.result === -1) {
      if (words.length === 0) {
        // Never marked, so nothing to clear.
        return 0;
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['vendor/mark.min.js'],
      });
      [first] = await mark();
    }
    markedTab = words.length > 0 ? tab.id : null;
    // -1: mark.js did not load.
    return Number.isInteger(first?.result) ? first.result : 0;
  }

  const changed = () => sendEvent('activeTabChanged', ACTIVE_TAB_SITE);

  // Another tab or window in front, or the tab in front loaded or moved.
  function watch() {
    chrome.tabs.onActivated.addListener(changed);
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        return;
      }
      const [tab] = await chrome.tabs
        .query({ active: true, windowId })
        .catch(() => []);
      // Only when focus brings another tab forward than the one on the card.
      if (!tab || tab.id !== lastRead) {
        changed();
      }
    });
    chrome.tabs.onUpdated.addListener((_tabId, change, tab) => {
      if (tab.active && (change.status === 'complete' || change.url)) {
        changed();
      }
    });
  }

  return { readActive, showActiveLink, highlightActive, watch };
}
