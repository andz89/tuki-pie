// Links that carry a token or an ID can do something when opened (a one-time
// login, a reset, an order) or open a private page. Page Info lists them but
// never opens them. See docs/superpowers/specs/2026-11-10-link-safety-design.md.

const SECRET_WORDS = new Set([
  'token',
  'key',
  'apikey',
  'auth',
  'code',
  'sig',
  'signature',
  'hash',
  'hmac',
  'otp',
  'secret',
  'session',
  'sid',
  'ticket',
  'reset',
  'verify',
  'confirm',
  'pass',
  'password',
  'jwt',
]);

const ID_WORDS = new Set(['id', 'uid', 'uuid', 'guid']);

// Ad and mail tracking adds long random values to ordinary links.
const TRACKING_KEYS = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'dclid',
  'msclkid',
  'yclid',
  'ttclid',
  'twclid',
  'igshid',
  'li_fat_id',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  '_hsenc',
  '_hsmi',
  'srsltid',
  'ref',
]);

// WordPress keys that only pick what to read, like ?p=12 on a site without
// pretty addresses.
const WORDPRESS_READ_KEYS = new Set([
  'p',
  'page_id',
  'cat',
  'tag',
  'author',
  'm',
  's',
  'paged',
  'page',
  'cpage',
  'attachment_id',
  'post_type',
  'lang',
  'ver',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{32,}$/i;
// No separators, so a slug like "summer-sale-2026" doesn't count.
const RANDOM = /^[a-z0-9]{16,}={0,2}$/i;

// "order_id", "itemId" and "apiKey" split into their words.
const keyWords = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const looksRandom = (value: string) =>
  UUID.test(value) ||
  (RANDOM.test(value) && /[a-z]/i.test(value) && /\d/.test(value));

// utm_ keys and ad click IDs: added by whoever linked here, not the page's own.
export function isTrackingKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_KEYS.has(lower);
}

const isPassedOver = (key: string) =>
  isTrackingKey(key) || WORDPRESS_READ_KEYS.has(key.toLowerCase());

export function carriesToken(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.some((part) => UUID.test(part) || LONG_HEX.test(part))) {
    return true;
  }

  return [...url.searchParams].some(([key, value]) => {
    if (isPassedOver(key)) {
      return false;
    }
    const words = keyWords(key);
    return (
      words.some((word) => SECRET_WORDS.has(word) || ID_WORDS.has(word)) ||
      looksRandom(value)
    );
  });
}
