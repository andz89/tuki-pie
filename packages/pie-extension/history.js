// Finds pages you visited in Chrome, for Page Info's History. Chrome's own
// text search matches whole words only, so "summit" would miss
// flowsummit.com: this reads the time range and matches the address itself.
// 'exact': the address is the text, ignoring case, http:// or https://,
// a leading www. and a trailing slash, so flowsummit.com/a finds
// https://www.flowsummit.com/a/.
// 'contains': the address has the text in it, ignoring case.

import { isWebAddress } from './protocol.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_DAYS = 3650;
export const MAX_TEXT = 200;
// Most visits read from Chrome in one search.
export const MAX_SCANNED = 20000;
// Most pages sent back.
export const MAX_RESULTS = 1000;
// Page Info refuses longer addresses.
export const MAX_URL = 2048;
const MAX_TITLE = 500;

const plain = (address) =>
  address
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');

// The test for one address, with the text prepared once, not per visit.
export function matcher(wanted, match) {
  if (!wanted) {
    return () => true;
  }
  if (match === 'contains') {
    const needle = wanted.toLowerCase();
    return (url) => url.toLowerCase().includes(needle);
  }
  const target = plain(wanted);
  return (url) => plain(url) === target;
}

export function createHistorySearch(chrome, now = () => Date.now()) {
  return async ({ text, days, match = 'exact' } = {}) => {
    const wanted = typeof text === 'string' ? text.trim() : '';
    const range = Number.isInteger(days) ? days : 1;
    if (
      wanted.length > MAX_TEXT ||
      range < 1 ||
      range > MAX_DAYS ||
      (match !== 'exact' && match !== 'contains')
    ) {
      throw new Error('bad-input');
    }
    const items = await chrome.history.search({
      text: '',
      startTime: now() - range * DAY_MS,
      maxResults: MAX_SCANNED,
    });
    const keep = matcher(wanted, match);
    // One row per address, with its latest visit. The cheap text test runs
    // first, so only the matches are parsed as addresses.
    const byUrl = new Map();
    for (const item of items) {
      const url = item.url ?? '';
      if (url.length > MAX_URL || !keep(url) || !isWebAddress(url)) {
        continue;
      }
      const lastVisit = Math.round(item.lastVisitTime ?? 0);
      const seen = byUrl.get(url);
      if (seen && seen.lastVisit >= lastVisit) {
        continue;
      }
      byUrl.set(url, {
        url,
        title: (item.title ?? '').slice(0, MAX_TITLE),
        lastVisit,
      });
    }
    const found = [...byUrl.values()].sort((a, b) => b.lastVisit - a.lastVisit);
    // Says which match it used, so Pie Launcher can tell an extension too
    // old to know the setting from one that applied it.
    return { match, visits: found.slice(0, MAX_RESULTS) };
  };
}
