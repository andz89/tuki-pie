import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageData } from '../../shared/types';
import { FOLLOW_TAB_MS, InfoCardReader } from './info-card-reader';
import type { CardReading } from './info-card-reader';

const page = (url: string): PageData => ({
  url,
  meta: { title: 'Shop', description: 'Things', lang: 'en', canonical: null },
  robots: [],
  headings: [
    { level: 1, text: 'Welcome' },
    { level: 2, text: 'More' },
  ],
  hreflang: [],
  resources: [],
  trackingSources: {
    srcs: ['https://www.googletagmanager.com/gtag/js?id=G-ABC123'],
    inlineScripts: [],
  },
  linkHrefs: ['https://a.com/?utm_source=x'],
  links: [
    { href: 'https://a.com/1', hidden: false },
    { href: 'https://a.com/2', hidden: false },
  ],
  unsafeBlankLinks: [],
  featuredImages: [{ property: 'og:image', url: 'https://a.com/og.png' }],
  images: ['https://a.com/1.png'],
  hyvorTalk: {
    tagName: 'hyvor-talk-comments',
    attributes: [{ name: 'website-id', value: '1234' }],
  },
});

let connected: boolean;
let readActive: ReturnType<typeof vi.fn<() => Promise<unknown>>>;
let seen: CardReading[];
let reader: InfoCardReader;

beforeEach(() => {
  vi.useFakeTimers();
  connected = true;
  readActive = vi.fn<() => Promise<unknown>>(async () => ({
    url: 'https://a.com/',
    page: page('https://a.com/'),
  }));
  seen = [];
  reader = new InfoCardReader({
    isConnected: () => connected,
    readActive,
    changed: (reading) => seen.push(reading),
  });
});

afterEach(() => vi.useRealTimers());

const last = () => seen[seen.length - 1];

describe('Info Card reader', () => {
  it('shows the page in front, from the same report Web Page uses', async () => {
    await reader.read();
    expect(last().status).toBe('ready');
    expect(last().page).toMatchObject({
      url: 'https://a.com/',
      title: 'Shop',
      h1Count: 1,
      h1s: ['Welcome'],
      linkCount: 2,
      imageCount: 1,
      utmTagged: 1,
      featuredImages: [{ property: 'og:image', url: 'https://a.com/og.png' }],
      hyvorTalk: { attributes: [{ name: 'website-id', value: '1234' }] },
      links: [
        { href: 'https://a.com/1', hidden: false },
        { href: 'https://a.com/2', hidden: false },
      ],
      images: ['https://a.com/1.png'],
    });
    expect(last().page?.trackers.length).toBeGreaterThan(0);
  });

  it('says so when Chrome is not connected, without asking it', async () => {
    connected = false;
    await reader.read();
    expect(last().status).toBe('not-connected');
    expect(readActive).not.toHaveBeenCalled();
  });

  it('says so when the tab has no web page', async () => {
    readActive.mockResolvedValue(null);
    await reader.read();
    expect(last()).toMatchObject({ status: 'no-page', page: null });
  });

  it('says reading failed when Chrome errs or sends something odd', async () => {
    readActive.mockRejectedValueOnce(new Error('no-answer'));
    await reader.read();
    expect(last().status).toBe('failed');
    readActive.mockResolvedValueOnce({ url: 'x', page: { nope: true } });
    await reader.read();
    expect(last().status).toBe('failed');
  });

  it('keeps the last page shown while the next one is read', async () => {
    await reader.read();
    const shown = last().page;
    void reader.read();
    expect(last()).toMatchObject({ status: 'reading', page: shown });
  });

  it('reads once after several quick tab changes', async () => {
    reader.tabChanged();
    reader.tabChanged();
    reader.tabChanged();
    await vi.advanceTimersByTimeAsync(FOLLOW_TAB_MS);
    expect(readActive).toHaveBeenCalledOnce();
  });

  it('shows only the newest read when an older one answers late', async () => {
    let answerFirst: (value: unknown) => void = () => undefined;
    readActive.mockImplementationOnce(
      () => new Promise((resolve) => (answerFirst = resolve)),
    );
    const first = reader.read();
    await reader.read();
    answerFirst(null);
    await first;
    expect(last().status).toBe('ready');
  });

  it('gives each new page a new id, so its pictures are fetched afresh', async () => {
    await reader.read();
    const firstId = last().pageId;
    await reader.read();
    expect(last().pageId).toBeGreaterThan(firstId);
  });
});
