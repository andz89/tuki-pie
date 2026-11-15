// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPageReport } from '../../main/page-info/page-report';
import type { PageData, SavedSite, SavedSiteSummary } from '../../shared/types';
import { savedSitesBridge } from './saved-sites-bridge';
import { matchesSearch, useSavedSitesStore } from './saved-sites.store';
import { SavedSites } from './SavedSites';

vi.mock('./saved-sites-bridge', () => ({
  savedSitesBridge: {
    list: vi.fn(),
    get: vi.fn(),
    setNote: vi.fn(async () => ({ ok: true, value: undefined })),
    remove: vi.fn(async () => ({ ok: true, value: undefined })),
    openLive: vi.fn(async () => ({ ok: true, value: undefined })),
    screenshot: vi.fn(async () => ({
      ok: true,
      value: 'data:image/jpeg;base64,AA',
    })),
    saveScreenshot: vi.fn(),
    copyScreenshot: vi.fn(),
    onChanged: vi.fn(() => () => undefined),
  },
}));

const summary = (changes: Partial<SavedSiteSummary>): SavedSiteSummary => ({
  id: 'a',
  address: 'https://shop.de/',
  title: 'Shop',
  note: '',
  hasScreenshot: false,
  savedAt: '2026-11-15T10:00:00.000Z',
  ...changes,
});

const SHOP = summary({ note: 'Check GA4' });
const BLOG = summary({ id: 'b', address: 'https://blog.io/', title: 'Blog' });

const page = (site: SavedSiteSummary): PageData => ({
  url: site.address,
  meta: { title: site.title, description: null, lang: 'en', canonical: null },
  robots: [],
  headings: [],
  hreflang: [],
  resources: [],
  trackingSources: { srcs: [], inlineScripts: [] },
  linkHrefs: [],
  links: [{ href: 'https://shop.de/about', hidden: false }],
  unsafeBlankLinks: [],
  featuredImages: [],
  images: ['https://shop.de/a.png'],
  hyvorTalk: null,
});

const full = (site: SavedSiteSummary): SavedSite => ({
  ...site,
  report: buildPageReport(page(site))!,
});

let container: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(savedSitesBridge.list).mockResolvedValue({
    ok: true,
    value: [SHOP, BLOG],
  });
  vi.mocked(savedSitesBridge.get).mockImplementation(async (id) => ({
    ok: true,
    value: full(id === 'a' ? SHOP : BLOG),
  }));
  useSavedSitesStore.setState({
    sites: [],
    selected: null,
    screenshot: { status: 'idle', url: null },
    problem: null,
    notice: null,
  });
  // jsdom's URL has no object addresses.
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:kept'),
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
  });
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function show(onBack?: () => void) {
  const made = createRoot(container);
  root = made;
  await act(async () => made.render(<SavedSites onBack={onBack} />));
}

const titles = () =>
  [...container.querySelectorAll('.saved-item-title')].map(
    (each) => each.textContent,
  );
const buttonWithText = (text: string) =>
  [...container.querySelectorAll('button')].find(
    (each) => each.textContent === text,
  )!;

async function open(title: string) {
  const item = [...container.querySelectorAll('.saved-item')].find((each) =>
    each.textContent?.startsWith(title),
  ) as HTMLButtonElement;
  await act(async () => item.click());
}

describe('matchesSearch', () => {
  it('finds a site by its title, address or note', () => {
    expect(matchesSearch(SHOP, 'shop')).toBe(true);
    expect(matchesSearch(SHOP, 'shop.de')).toBe(true);
    expect(matchesSearch(SHOP, 'ga4 check')).toBe(true);
    expect(matchesSearch(SHOP, 'blog')).toBe(false);
  });
});

describe('SavedSites', () => {
  it('lists the saved sites', async () => {
    await show();
    expect(titles()).toEqual(['Shop', 'Blog']);
  });

  it('filters the list as you search', async () => {
    await show();
    const search = container.querySelector<HTMLInputElement>(
      'input[aria-label="Search saved sites"]',
    )!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set?.call(search, 'ga4');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(titles()).toEqual(['Shop']);
  });

  it('shows the saved results with links and images as addresses', async () => {
    await show();
    await open('Shop');
    expect(container.querySelector('.saved-detail h1')?.textContent).toBe(
      'Shop',
    );
    act(() => buttonWithText('Links (1)').click());
    expect(container.querySelector('.saved-address')?.textContent).toBe(
      'https://shop.de/about',
    );
    act(() => buttonWithText('Images (1)').click());
    expect(container.querySelector('.saved-address')?.textContent).toBe(
      'https://shop.de/a.png',
    );
    expect(buttonWithText('Screenshot')).toBeUndefined();
  });

  it('saves the note a moment after you stop typing', async () => {
    vi.useFakeTimers();
    await show();
    await open('Shop');
    const note = container.querySelector('textarea')!;
    expect(note.value).toBe('Check GA4');
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set?.call(note, 'Check GA4 and Meta');
      note.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(savedSitesBridge.setNote).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(500));
    expect(savedSitesBridge.setNote).toHaveBeenCalledWith(
      'a',
      'Check GA4 and Meta',
    );
  });

  it('asks before deleting', async () => {
    await show();
    await open('Shop');
    act(() => buttonWithText('Delete').click());
    expect(savedSitesBridge.remove).not.toHaveBeenCalled();
    expect(container.querySelector('.confirm-bar')?.textContent).toContain(
      'Delete Shop?',
    );
    const confirm = container.querySelector<HTMLButtonElement>(
      '.confirm-bar .button-danger',
    )!;
    await act(async () => confirm.click());
    expect(savedSitesBridge.remove).toHaveBeenCalledWith('a');
  });

  it('opens a saved site live, and goes back when shown in Page Info', async () => {
    const onBack = vi.fn();
    await show(onBack);
    await open('Shop');
    await act(async () => buttonWithText('Open in Page Info').click());
    expect(savedSitesBridge.openLive).toHaveBeenCalledWith('a');
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows the saved screenshot', async () => {
    vi.mocked(savedSitesBridge.list).mockResolvedValue({
      ok: true,
      value: [{ ...SHOP, hasScreenshot: true }],
    });
    vi.mocked(savedSitesBridge.get).mockResolvedValue({
      ok: true,
      value: full({ ...SHOP, hasScreenshot: true }),
    });
    await show();
    await open('Shop');
    await act(async () => buttonWithText('Screenshot').click());
    expect(
      container.querySelector('.saved-screenshot img')?.getAttribute('src'),
    ).toBe('blob:kept');
  });

  it('says when the screenshot file is missing', async () => {
    vi.mocked(savedSitesBridge.list).mockResolvedValue({
      ok: true,
      value: [{ ...SHOP, hasScreenshot: true }],
    });
    vi.mocked(savedSitesBridge.get).mockResolvedValue({
      ok: true,
      value: full({ ...SHOP, hasScreenshot: true }),
    });
    vi.mocked(savedSitesBridge.screenshot).mockResolvedValue({
      ok: true,
      value: null,
    });
    await show();
    await open('Shop');
    await act(async () => buttonWithText('Screenshot').click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'missing',
    );
  });

  it('drops a note typed just before the site was deleted', async () => {
    vi.useFakeTimers();
    await show();
    await open('Shop');
    const note = container.querySelector('textarea')!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set?.call(note, 'late');
      note.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => buttonWithText('Delete').click());
    const confirm = container.querySelector<HTMLButtonElement>(
      '.confirm-bar .button-danger',
    )!;
    await act(async () => confirm.click());
    await act(async () => vi.advanceTimersByTime(500));
    expect(savedSitesBridge.setNote).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('stays on the list when opening live fails', async () => {
    vi.mocked(savedSitesBridge.openLive).mockResolvedValue({
      ok: false,
      error: 'Chrome not connected.',
    });
    const onBack = vi.fn();
    await show(onBack);
    await open('Shop');
    await act(async () => buttonWithText('Open in Page Info').click());
    expect(onBack).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Chrome not connected.',
    );
  });

  it('closes a site that was deleted elsewhere', async () => {
    await show();
    await open('Shop');
    vi.mocked(savedSitesBridge.list).mockResolvedValue({
      ok: true,
      value: [BLOG],
    });
    await act(async () => useSavedSitesStore.getState().refresh());
    expect(container.querySelector('.saved-detail')).toBeNull();
  });
});
