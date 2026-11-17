// Shared by the extension and Pie Launcher, so both sides agree on every
// message. Pie Launcher bundles this file into its main process.

export const PORT = 17361;
export const EXTENSION_ID = 'jagkanmmpjdcokchoankopikfhjnnkio';

export const CLOSE = {
  REPLACED: 4001,
  BAD_CODE: 4002,
};

export const MSG = {
  HELLO: 'hello',
  CHALLENGE: 'challenge',
  PROOF: 'proof',
  READY: 'ready',
  REQUEST: 'request',
  REPLY: 'reply',
  EVENT: 'event',
  PING: 'ping',
};

export const ACTIONS = [
  'open',
  'reload',
  'stop',
  'read',
  'goToTab',
  'activeTab',
  'showLink',
  'openTabs',
  'capture',
  'forget',
  'setSuggestions',
  'image',
  'history',
  'readActive',
  'showActiveLink',
  'highlightActive',
];

// Most links Page Info opens in one go.
export const MAX_OPEN_TABS = 100;
export const EVENTS = [
  'committed',
  'loaded',
  'changedInPlace',
  'failed',
  'cancelled',
  'closed',
  'activeTabChanged',
];

// Each tab in Page Info names itself with a site id, so every request and
// event belongs to one of them. A request without one uses DEFAULT_SITE.
export const DEFAULT_SITE = 'main';

// The site name on events about the tab you are looking at, for the Info
// Card. Page Info's own tabs are numbered, so it never matches one.
export const ACTIVE_TAB_SITE = 'active-tab';

export function isSite(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value);
}

// Chrome suspends a quiet service worker after 30 seconds.
export const PING_MS = 20000;
export const MAX_HANDSHAKE_BYTES = 4096;
export const MAX_MESSAGE_BYTES = 32 * 1024 * 1024;
export const TOO_LARGE = 'too-large';

// Each side signs different text, so one side's proof can never be bounced
// back as the other's.
export const appProofText = (extNonce, appNonce) =>
  `pie-app|${extNonce}|${appNonce}`;
export const extProofText = (appNonce, extNonce) =>
  `pie-ext|${appNonce}|${extNonce}`;

export function isWebAddress(value) {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// The kinds of link Page Info lists: web pages, email, phone and text.
export function isWebAddressOrContact(value) {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    return ['http:', 'https:', 'mailto:', 'tel:', 'sms:'].includes(
      new URL(value).protocol,
    );
  } catch {
    return false;
  }
}

// The same page, apart from anything after `#`.
export function sameAddress(first, second) {
  if (!isWebAddress(first) || !isWebAddress(second)) {
    return false;
  }
  const a = new URL(first);
  const b = new URL(second);
  a.hash = '';
  b.hash = '';
  return a.href === b.href;
}
