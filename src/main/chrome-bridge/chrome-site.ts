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
  destroy: () => void;
};

type Bridge = Pick<ChromeBridge, 'request' | 'onEvent'>;

// Scrolling and stitching a long page takes about 50 seconds.
// A device with a reload loads the page twice.
export const CAPTURE_MS = 90000;

// Page Info's site, as a Chrome tab the extension opens or finds.
export function createChromeSite(
  bridge: Bridge,
  events: ChromeSiteEvents,
): ChromeSite {
  const handlers: Record<SiteEventName, () => void> = {
    committed: events.committed,
    loaded: events.loaded,
    changedInPlace: events.changedInPlace,
    failed: () => events.failed(ERROR_FAILED),
    cancelled: events.cancelled,
    closed: events.closed,
    // Page Info's window follows the active tab itself, see page-info-window.
    activeTabChanged: () => undefined,
  };
  const stopListening = bridge.onEvent((name) => handlers[name]());

  const orFail = (action: string, args?: Record<string, unknown>) => {
    bridge.request(action, args).catch(() => events.failed(ERROR_FAILED));
  };
  const quietly = (action: string) => {
    bridge.request(action).catch(() => undefined);
  };

  return {
    load: (url) => orFail('open', { url }),
    reload: () => orFail('reload'),
    stop: () => quietly('stop'),
    read: () => bridge.request('read'),
    goToTab: () => quietly('goToTab'),
    showLink: (index, href) => bridge.request('showLink', { index, href }),
    capture: (size) => bridge.request('capture', { ...size }, CAPTURE_MS),
    openTabs: (urls) => {
      bridge.request('openTabs', { urls }).catch(() => undefined);
    },
    destroy: stopListening,
  };
}
