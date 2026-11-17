import type { PageSite } from '../page-info/page-info-controller';
import type { ChromeBridge, SiteEventName } from './chrome-bridge';

// Any failure other than Chromium's "aborted" code. The extension already
// sorts aborted loads into cancelled ones or nothing.
export const ERROR_FAILED = -2;

export interface ChromeSiteEvents {
  committed: () => void;
  loaded: () => void;
  changedInPlace: () => void;
  failed: (errorCode: number) => void;
  cancelled: () => void;
  closed: () => void;
}

export type ChromeSite = PageSite & {
  // The Page Info tab closed: the Chrome tab opened for it closes too.
  forget: () => void;
  destroy: () => void;
};

type Bridge = Pick<ChromeBridge, 'request' | 'onEvent'>;

// Scrolling and stitching a long page takes about 50 seconds.
// A device with a reload loads the page twice.
export const CAPTURE_MS = 90000;

// One Page Info tab's site, as a Chrome tab the extension opens or finds.
// `site` names that tab to the extension, so each has its own Chrome tab and
// hears only its own events.
export function createChromeSite(
  bridge: Bridge,
  site: string,
  events: ChromeSiteEvents,
): ChromeSite {
  const handlers: Record<SiteEventName, () => void> = {
    committed: events.committed,
    loaded: events.loaded,
    changedInPlace: events.changedInPlace,
    failed: () => events.failed(ERROR_FAILED),
    cancelled: events.cancelled,
    closed: events.closed,
    // Only for the Info Card, which has its own site name.
    activeTabChanged: () => undefined,
  };
  const stopListening = bridge.onEvent((name, from) => {
    if (from === site) {
      handlers[name]();
    }
  });

  const orFail = (action: string, args: Record<string, unknown> = {}) => {
    bridge
      .request(action, { ...args, site })
      .catch(() => events.failed(ERROR_FAILED));
  };
  const quietly = (action: string) => {
    bridge.request(action, { site }).catch(() => undefined);
  };

  return {
    load: (url) => orFail('open', { url }),
    reload: () => orFail('reload'),
    stop: () => quietly('stop'),
    read: () => bridge.request('read', { site }),
    goToTab: () => quietly('goToTab'),
    showLink: (index, href) =>
      bridge.request('showLink', { index, href, site }),
    capture: (size) => bridge.request('capture', { ...size, site }, CAPTURE_MS),
    openTabs: (urls) => {
      bridge.request('openTabs', { urls }).catch(() => undefined);
    },
    forget: () => quietly('forget'),
    destroy: stopListening,
  };
}
