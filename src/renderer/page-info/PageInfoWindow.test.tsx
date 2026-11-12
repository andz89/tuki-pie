// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPageReport } from '../../main/page-info/page-report';
import type { PageData, PageInfoUpdate } from '../../shared/types';
import { pageInfoBridge } from './page-info-bridge';
import { shownLinks } from './page-links';
import { usePageInfoStore } from './page-info.store';
import { PageInfoWindow } from './PageInfoWindow';

vi.mock('./page-info-bridge', () => ({
  pageInfoBridge: {
    getState: vi.fn(async () => ({ ok: false, error: 'not in a test' })),
    onUpdate: vi.fn(() => () => undefined),
    settings: { get: vi.fn(async () => ({ ok: false, error: 'no' })) },
    image: vi.fn(async () => ({
      ok: true,
      value: { dataUrl: 'data:image/webp;base64,AA', width: 1, height: 1 },
    })),
  },
}));
vi.mock('./page-links', async (original) => {
  const actual = await original<typeof import('./page-links')>();
  return { ...actual, shownLinks: vi.fn(actual.shownLinks) };
});

const PAGE: PageData = {
  url: 'https://example.com/',
  meta: { title: 'Hi', description: null, lang: 'en', canonical: null },
  robots: [],
  headings: [{ level: 1, text: 'Hi' }],
  hreflang: [],
  resources: [],
  trackingSources: { srcs: [], inlineScripts: [] },
  linkHrefs: [],
  links: Array.from({ length: 300 }, (_, index) => ({
    href: `https://example.com/page-${index}`,
    hidden: false,
  })),
  unsafeBlankLinks: [],
  featuredImages: [],
  images: [],
  hyvorTalk: null,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // jsdom has no CSS Custom Highlight API; the window then skips marking.
  vi.stubGlobal('CSS', {});
  // Nor <dialog> methods, which the image viewer uses.
  HTMLDialogElement.prototype.close ??= function close() {};
  HTMLDialogElement.prototype.showModal ??= function showModal() {};
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function showReport() {
  const update: PageInfoUpdate = {
    status: 'done',
    address: PAGE.url,
    report: buildPageReport(PAGE),
    message: null,
    siteVisible: false,
    chromeConnected: true,
    reportId: 1,
  };
  usePageInfoStore.setState({ update });
  root = createRoot(container);
  await act(async () => root.render(<PageInfoWindow />));
}

// Sets an input's value the way typing does, so React sees the change.
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const input = (label: string) =>
  container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;

describe('PageInfoWindow', () => {
  it('lists the links of the report', async () => {
    await showReport();
    expect(container.querySelectorAll('.link-row')).toHaveLength(300);
  });

  it('opens the Link filters panel from the Links tab', async () => {
    await showReport();
    const toggle = [...container.querySelectorAll('button')].find((each) =>
      each.textContent?.startsWith('Link filters'),
    )!;
    expect(container.querySelector('.link-filters-panel')).toBeNull();
    act(() => toggle.click());
    expect(container.querySelector('.link-filters-panel')).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows duplicate links again when Hide duplicates is unticked', async () => {
    PAGE.links.push({ href: 'https://example.com/page-0', hidden: false });
    try {
      await showReport();
      expect(container.querySelectorAll('.link-row')).toHaveLength(300);
      const hide = [...container.querySelectorAll('label')]
        .find((label) => label.textContent?.includes('Hide duplicates'))!
        .querySelector('input')!;
      act(() => hide.click());
      expect(container.querySelectorAll('.link-row')).toHaveLength(301);
    } finally {
      PAGE.links.pop();
    }
  });

  it('asks Chrome for an image only once its row scrolls into view', async () => {
    const shown: Array<(visible: boolean) => void> = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          callback: (entries: { isIntersecting: boolean }[]) => void,
        ) {
          shown.push((visible) => callback([{ isIntersecting: visible }]));
        }
        observe() {}
        disconnect() {}
      },
    );
    PAGE.images = ['https://example.com/a.png', 'https://example.com/b.png'];
    try {
      vi.mocked(pageInfoBridge.image).mockClear();
      await showReport();
      expect(pageInfoBridge.image).not.toHaveBeenCalled();
      // The newest watcher: the dashboard tile remounts once per check.
      await act(async () => shown.at(-1)?.(true));
      expect(pageInfoBridge.image).toHaveBeenCalledOnce();
    } finally {
      PAGE.images = [];
    }
  });

  it('does not rebuild the link lists while you type an address', async () => {
    await showReport();
    vi.mocked(shownLinks).mockClear();
    type(input('Web address'), 'other.com');
    expect(input('Web address').value).toBe('other.com');
    expect(shownLinks).not.toHaveBeenCalled();
  });

  it('does not rebuild the link lists while you type a highlight', async () => {
    await showReport();
    vi.mocked(shownLinks).mockClear();
    type(input('Highlight words in the results'), 'page');
    expect(shownLinks).not.toHaveBeenCalled();
  });
});
