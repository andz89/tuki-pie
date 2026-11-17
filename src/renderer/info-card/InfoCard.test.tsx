// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type { InfoCardPage, InfoCardState } from '../../shared/types';
import { infoCardBridge } from './info-card-bridge';
import { HIGHLIGHT_WAIT_MS } from './HighlightField';
import { InfoCard, sameAddress } from './InfoCard';

vi.mock('./info-card-bridge', () => ({
  infoCardBridge: {
    getState: vi.fn(),
    setPinned: vi.fn(async () => ({ ok: true, value: undefined })),
    setLayout: vi.fn(async () => ({ ok: true, value: undefined })),
    setFields: vi.fn(async () => ({ ok: true, value: undefined })),
    image: vi.fn(async () => ({
      ok: true,
      value: { dataUrl: 'data:image/png;base64,AA', width: 1, height: 1 },
    })),
    close: vi.fn(async () => ({ ok: true, value: undefined })),
    openInWebPage: vi.fn(async () => ({ ok: true, value: undefined })),
    setView: vi.fn(async () => ({ ok: true, value: undefined })),
    showLink: vi.fn(async () => ({ ok: true, value: 'shown' })),
    openLinks: vi.fn(async () => ({ ok: true, value: true })),
    openHere: vi.fn(async () => ({ ok: true, value: undefined })),
    setLinkFilter: vi.fn(async () => ({ ok: true, value: undefined })),
    setLinksOpenIn: vi.fn(async () => ({ ok: true, value: undefined })),
    highlight: vi.fn(async () => ({ ok: true, value: 0 })),
    onUpdate: vi.fn(() => () => undefined),
  },
}));

const PAGE: InfoCardPage = {
  url: 'https://shop.de/',
  title: 'Shop - Home',
  description: 'Things to buy',
  canonical: 'https://shop.de/home',
  lang: 'de',
  h1Count: 1,
  h1s: ['Welcome'],
  linkCount: 42,
  imageCount: 12,
  issueCount: 3,
  trackers: ['Google Analytics 4'],
  utmTagged: 2,
  hyvorTalk: {
    attributes: [
      { name: 'website-id', value: '1234' },
      { name: 'page-id', value: 'home' },
    ],
  },
  featuredImages: [{ property: 'og:image', url: '/og.png' }],
  links: [
    { href: 'https://shop.de/shoes', hidden: false },
    { href: 'https://shop.de/hats', hidden: false },
  ],
  images: ['https://shop.de/hero.jpg', 'https://shop.de/logo.png'],
};

const state = (changes: Partial<InfoCardState> = {}): InfoCardState => ({
  status: 'ready',
  page: PAGE,
  pageId: 1,
  view: 'info',
  pinned: false,
  linkFilter: DEFAULT_SETTINGS.linkFilter,
  linksOpenIn: 'chrome',
  layout: 'sidebar',
  fields: [
    'title',
    'canonical',
    'headings',
    'counts',
    'tracking',
    'hyvor',
    'images',
  ],
  theme: 'dark',
  ...changes,
});

let root: Root;
let host: HTMLDivElement;
let pushUpdate: (next: InfoCardState) => void;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

async function show(first: InfoCardState) {
  vi.mocked(infoCardBridge.getState).mockResolvedValue({
    ok: true,
    value: first,
  });
  vi.mocked(infoCardBridge.onUpdate).mockImplementation((listener) => {
    pushUpdate = listener;
    return () => undefined;
  });
  await act(async () => root.render(<InfoCard />));
}

const text = () => host.textContent ?? '';
const button = (label: string) =>
  host.querySelector<HTMLButtonElement>(`button[aria-label^="${label}"]`)!;

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no dialogs; the Images card's viewer is one.
  HTMLDialogElement.prototype.close ??= function close() {};
  HTMLDialogElement.prototype.showModal ??= function showModal() {};
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('Info Card', () => {
  it('shows the page info of the tab in front', async () => {
    await show(state());
    expect(text()).toContain('Shop - Home');
    expect(text()).toContain('https://shop.de/');
    expect(text()).toContain('H1: 1');
    expect(text()).toContain('42 links');
    expect(text()).toContain('Google Analytics 4');
    expect(text()).toContain('og:image');
    // The featured image comes through the card's own Chrome fetch.
    expect(infoCardBridge.image).toHaveBeenCalledWith(
      'https://shop.de/og.png',
      'thumb',
    );
  });

  it('changes when Chrome switches to another tab', async () => {
    await show(state());
    await act(async () =>
      pushUpdate(state({ page: { ...PAGE, title: 'Blog' } })),
    );
    expect(text()).toContain('Blog');
    expect(text()).not.toContain('Shop - Home');
  });

  it('shows only the groups the user ticked', async () => {
    await show(state({ fields: ['counts'] }));
    expect(text()).toContain('42 links');
    expect(text()).not.toContain('Shop - Home');
    expect(text()).not.toContain('Tracking');
  });

  it('shows title with URL, description and language, canonical on its own', async () => {
    await show(state({ fields: ['canonical'] }));
    expect(text()).toContain('https://shop.de/home');
    expect(text()).not.toContain('Shop - Home');
    expect(text()).not.toContain('Things to buy');
    await act(async () => pushUpdate(state({ fields: ['title'] })));
    expect(text()).toContain('Shop - Home');
    expect(text()).toContain('Things to buy');
    expect(text()).toContain('https://shop.de/');
    expect(text()).toContain('Language: de');
    expect(text()).not.toContain('https://shop.de/home');
  });

  it('ticks title, URL, description and language together, canonical apart', async () => {
    await show(state());
    await act(async () => button('Choose what to show').click());
    const labels = [...host.querySelectorAll('label')].map(
      (label) => label.textContent,
    );
    expect(labels.slice(0, 2)).toEqual([
      'Title, URL, description, language',
      'Canonical',
    ]);
  });

  it('marks a canonical that points at the page itself', async () => {
    await show(state({ fields: ['canonical'] }));
    expect(text()).toContain('https://shop.de/home');
    expect(text()).not.toContain('Same site');
    await act(async () =>
      pushUpdate(
        state({
          fields: ['canonical'],
          page: { ...PAGE, canonical: 'https://shop.de/' },
        }),
      ),
    );
    expect(text()).toContain('Same site');
  });

  it('compares a canonical with the page address', () => {
    expect(sameAddress('https://shop.de/', 'https://shop.de/')).toBe(true);
    expect(sameAddress('/', 'https://shop.de/')).toBe(true);
    expect(sameAddress('https://shop.de/', 'https://shop.de/#top')).toBe(true);
    expect(sameAddress('https://shop.de/home', 'https://shop.de/')).toBe(false);
    expect(sameAddress('https://shop.de/?a=1', 'https://shop.de/')).toBe(false);
  });

  it('shows Hyvor Talk, or that there is none', async () => {
    await show(state({ fields: ['hyvor'] }));
    expect(text()).toContain('Hyvor Talk');
    expect(text()).toContain('website-id: 1234');
    await act(async () =>
      pushUpdate(
        state({ fields: ['hyvor'], page: { ...PAGE, hyvorTalk: null } }),
      ),
    );
    expect(text()).toContain('None found');
  });

  it('says why nothing is shown', async () => {
    await show(state({ status: 'no-page', page: null }));
    expect(text()).toContain('no web page');
    await act(async () =>
      pushUpdate(state({ status: 'not-connected', page: null })),
    );
    expect(text()).toContain('Connect Chrome');
  });

  it('opens the page in Web Page, once there is one', async () => {
    await show(state({ status: 'no-page', page: null }));
    expect(button('Open in Web Page').disabled).toBe(true);
    await act(async () => pushUpdate(state()));
    await act(async () => button('Open in Web Page').click());
    expect(infoCardBridge.openInWebPage).toHaveBeenCalledOnce();
  });

  it('opens the Links card from the links tile', async () => {
    await show(state());
    const tile = [...host.querySelectorAll('button')].find((each) =>
      each.textContent?.includes('42 links'),
    )!;
    await act(async () => tile.click());
    expect(infoCardBridge.setView).toHaveBeenCalledWith('links');
  });

  it('lists the links in place of the Info Card, and goes back', async () => {
    await show(state({ view: 'links' }));
    expect(text()).toContain('Links');
    expect(text()).toContain('https://shop.de/shoes');
    expect(text()).toContain('https://shop.de/hats');
    expect(text()).not.toContain('Things to buy');
    expect(button('Layout')).toBeNull();
    await act(async () => button('Back to Info Card').click());
    expect(infoCardBridge.setView).toHaveBeenCalledWith('info');
  });

  const row = (label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('.link-row button')].find(
      (each) => each.textContent === label,
    )!;

  it('shows a link, and opens it in Chrome when set to Chrome', async () => {
    await show(state({ view: 'links' }));
    await act(async () => row('Show on page').click());
    expect(infoCardBridge.showLink).toHaveBeenCalledWith(
      0,
      'https://shop.de/shoes',
    );
    expect(text()).toContain('Shown in Chrome');
    // Ctrl+click too: every Open follows the switch.
    await act(async () =>
      row('Open').dispatchEvent(
        new MouseEvent('click', { bubbles: true, ctrlKey: true }),
      ),
    );
    expect(infoCardBridge.openLinks).toHaveBeenCalledWith(
      ['https://shop.de/shoes'],
      [],
    );
    expect(infoCardBridge.openHere).not.toHaveBeenCalled();
    expect(text()).toContain('Open all in Chrome');
    expect(text()).not.toContain('Open all in Web Page');
  });

  it('opens links in Web Page when set to Web Page', async () => {
    await show(state({ view: 'links', linksOpenIn: 'web-page' }));
    await act(async () => row('Open').click());
    expect(infoCardBridge.openHere).toHaveBeenCalledWith(
      'https://shop.de/shoes',
      false,
    );
    expect(infoCardBridge.openLinks).not.toHaveBeenCalled();
    expect(text()).toContain('Open all in Web Page');
    expect(text()).not.toContain('Open all in Chrome');
  });

  const type = async (label: string, value: string) => {
    const field = host.querySelector<HTMLInputElement>(
      `input[aria-label^="${label}"]`,
    )!;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setValue.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const hits = () =>
    [...host.querySelectorAll('.link-hit')].map((each) => each.textContent);
  const settle = () =>
    act(() => new Promise((done) => setTimeout(done, HIGHLIGHT_WAIT_MS + 50)));

  it('highlights words in the list and on the page, hiding nothing', async () => {
    vi.mocked(infoCardBridge.highlight).mockResolvedValue({
      ok: true,
      value: 2,
    });
    await show(state({ view: 'links' }));
    await type('Highlight words', 'hat');
    expect(hits()).toEqual(['hat']);
    expect(text()).toContain('https://shop.de/shoes');
    await settle();
    expect(infoCardBridge.highlight).toHaveBeenCalledWith('hat');
    expect(text()).toContain('2 on page');
    // Emptied: the page's marks are cleared.
    await type('Highlight words', '');
    await settle();
    expect(infoCardBridge.highlight).toHaveBeenLastCalledWith('');
  });

  it('says so when the page could not be marked', async () => {
    vi.mocked(infoCardBridge.highlight).mockResolvedValue({
      ok: true,
      value: null,
    });
    await show(state({ view: 'links' }));
    await type('Highlight words', 'hat');
    await settle();
    expect(text()).toContain('reload it in chrome://extensions');
  });

  it('leaves the search box to filtering only', async () => {
    await show(state({ view: 'links' }));
    await type('Filter links by address', 'hat');
    expect(hits()).toEqual([]);
    expect(text()).not.toContain('https://shop.de/shoes');
  });

  it('opens the Images card from the images tile', async () => {
    await show(state());
    const tile = [...host.querySelectorAll('button')].find((each) =>
      each.textContent?.includes('12 images'),
    )!;
    await act(async () => tile.click());
    expect(infoCardBridge.setView).toHaveBeenCalledWith('images');
  });

  it('lists the images in place of the Info Card, opening them in Chrome', async () => {
    await show(state({ view: 'images' }));
    expect(text()).toContain('Images');
    expect(text()).toContain('https://shop.de/hero.jpg');
    expect(text()).toContain('https://shop.de/logo.png');
    expect(text()).not.toContain('Things to buy');
    expect(button('Back to Info Card')).not.toBeNull();
    await act(async () => row('Open').click());
    expect(infoCardBridge.openLinks).toHaveBeenCalledWith(
      ['https://shop.de/hero.jpg'],
      [],
    );
  });

  it('remembers where to open links', async () => {
    await show(state({ view: 'links' }));
    const choice = [
      ...host.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    ].find((each) => each.textContent === 'Web Page')!;
    await act(async () => choice.click());
    expect(infoCardBridge.setLinksOpenIn).toHaveBeenCalledWith('web-page');
  });

  it('pins and unpins', async () => {
    await show(state());
    await act(async () => button('Pin').click());
    expect(infoCardBridge.setPinned).toHaveBeenCalledWith(true);
    await act(async () => pushUpdate(state({ pinned: true })));
    expect(button('Unpin').getAttribute('aria-pressed')).toBe('true');
  });

  it('moves to another layout', async () => {
    await show(state());
    await act(async () => button('Layout').click());
    const top = [...host.querySelectorAll('label')].find(
      (label) => label.textContent === 'Top',
    )!;
    await act(async () => top.querySelector('input')!.click());
    expect(infoCardBridge.setLayout).toHaveBeenCalledWith('top');
  });

  it('shows the menus as a small card over the content', async () => {
    await show(state());
    await act(async () => button('Layout').click());
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(text()).toContain('Shop - Home');
    await act(async () => button('Done').click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => button('Choose what to show').click());
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    );
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps both of two quick ticks', async () => {
    await show(state());
    await act(async () => button('Choose what to show').click());
    const box = (name: string) =>
      [...host.querySelectorAll('label')]
        .find((label) => label.textContent === name)!
        .querySelector('input')!;
    await act(async () => box('Tracking').click());
    await act(async () => box('Counts').click());
    expect(infoCardBridge.setFields).toHaveBeenLastCalledWith([
      'title',
      'canonical',
      'headings',
      'hyvor',
      'images',
    ]);
  });

  it('turns a group off from the list', async () => {
    await show(state());
    await act(async () => button('Choose what to show').click());
    const tracking = [...host.querySelectorAll('label')].find(
      (label) => label.textContent === 'Tracking',
    )!;
    await act(async () => tracking.querySelector('input')!.click());
    expect(infoCardBridge.setFields).toHaveBeenCalledWith([
      'title',
      'canonical',
      'headings',
      'counts',
      'hyvor',
      'images',
    ]);
  });
});
