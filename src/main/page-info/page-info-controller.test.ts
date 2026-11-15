import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageData, PageInfoUpdate } from '../../shared/types';
import { UserError } from '../services/user-error';
import { PageInfoController } from './page-info-controller';
import type { PageSite, SiteViewer } from './page-info-controller';

const page = (url: string): PageData => ({
  url,
  meta: { title: 'Hi', description: null, lang: 'en', canonical: null },
  robots: [],
  headings: [{ level: 1, text: 'Hi' }],
  hreflang: [],
  resources: [],
  trackingSources: { srcs: [], inlineScripts: [] },
  linkHrefs: [],
  links: [],
  unsafeBlankLinks: [],
  featuredImages: [],
  images: [],
  hyvorTalk: null,
});

const flush = () => vi.advanceTimersByTimeAsync(0);

const SHOT = { dataUrl: 'data:image/jpeg;base64,AAAA', method: 'debugger' };

let site: { [Key in keyof PageSite]: ReturnType<typeof vi.fn> };
let viewer: { [Key in keyof SiteViewer]: ReturnType<typeof vi.fn> };
let send: ReturnType<typeof vi.fn<(update: PageInfoUpdate) => void>>;
let controller: PageInfoController;

beforeEach(() => {
  vi.useFakeTimers();
  site = {
    load: vi.fn(),
    reload: vi.fn(),
    stop: vi.fn(),
    read: vi.fn(async () => page('https://example.com/')),
    goToTab: vi.fn(),
    showLink: vi.fn(async () => 'shown'),
    openTabs: vi.fn(),
    capture: vi.fn(async () => SHOT),
  };
  viewer = { show: vi.fn(), hide: vi.fn() };
  send = vi.fn();
  controller = new PageInfoController(
    site as unknown as PageSite,
    viewer as unknown as SiteViewer,
    send,
  );
  controller.setChromeConnected(true);
  send.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checking an address', () => {
  it('loads a bare address over https and says it is checking', () => {
    controller.check('example.com');
    expect(site.load).toHaveBeenCalledExactlyOnceWith('https://example.com');
    expect(send.mock.lastCall?.[0]).toMatchObject({
      status: 'checking',
      address: 'https://example.com',
      report: null,
    });
  });

  it('refuses another kind of address', () => {
    expect(() => controller.check('file:///x')).toThrow(
      new UserError('Enter a web address, like example.com.'),
    );
    expect(site.load).not.toHaveBeenCalled();
  });
});

describe('reading the page', () => {
  it('reads when loading finishes, and again 1500 ms later', async () => {
    controller.check('example.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    expect(site.read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(site.read).toHaveBeenCalledTimes(2);
  });

  it('shows the report once read', async () => {
    controller.check('example.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    expect(controller.state()).toMatchObject({ status: 'done', message: null });
    expect(controller.state().report?.meta.title).toBe('Hi');
  });

  it('sends three equal reads of one page once', async () => {
    controller.check('example.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    send.mockClear();
    await vi.advanceTimersByTimeAsync(10000);
    expect(site.read).toHaveBeenCalledTimes(3);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends a later read that found more, under the same report id', async () => {
    controller.check('example.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    const first = controller.state().reportId;
    const later = page('https://example.com/');
    site.read.mockResolvedValue({
      ...later,
      meta: { ...later.meta, title: 'Hi again' },
    });
    await vi.advanceTimersByTimeAsync(1500);
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ reportId: first }),
    );
    expect(controller.state().report?.meta.title).toBe('Hi again');
  });

  it('gives each new page a new report id', async () => {
    controller.check('a.com');
    const first = controller.state().reportId;
    controller.check('b.com');
    expect(controller.state().reportId).not.toBe(first);
    const second = controller.state().reportId;
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    site.read.mockResolvedValue(page('https://example.com/other'));
    controller.sitePageChangedInPlace();
    await vi.advanceTimersByTimeAsync(500);
    expect(controller.state().reportId).not.toBe(second);
  });

  it('shows the address the page ended on', async () => {
    site.read.mockResolvedValue(page('https://example.com/login'));
    controller.check('example.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    expect(controller.state().address).toBe('https://example.com/login');
  });

  it('ignores a late answer from an older page', async () => {
    let finishOld!: (data: PageData) => void;
    site.read.mockReturnValueOnce(
      new Promise((resolve) => {
        finishOld = resolve;
      }),
    );
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();

    site.read.mockResolvedValueOnce(page('https://b.com/'));
    controller.check('b.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();

    finishOld(page('https://a.com/'));
    await flush();
    expect(controller.state().address).toBe('https://b.com/');
  });

  it('a new page cancels the delayed read', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    controller.check('b.com');
    await vi.advanceTimersByTimeAsync(10000);
    expect(site.read).toHaveBeenCalledTimes(1);
  });

  it('reads when a single-page site changes address', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    site.read.mockClear();
    controller.sitePageChangedInPlace();
    await vi.advanceTimersByTimeAsync(500);
    expect(site.read).toHaveBeenCalled();
  });

  it('reads once after a burst of address changes', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await vi.advanceTimersByTimeAsync(10000);
    site.read.mockClear();
    for (let step = 0; step < 5; step++) {
      controller.sitePageChangedInPlace();
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(site.read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(site.read).toHaveBeenCalledTimes(1);
  });

  it('keeps the screenshot and the ticks when only the # part changed', async () => {
    site.read.mockResolvedValue(page('https://example.com/'));
    controller.check('example.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    await controller.capture({ device: '', reload: false, section: '' });
    const id = controller.state().reportId;
    site.read.mockResolvedValue(page('https://example.com/#reviews'));
    controller.sitePageChangedInPlace();
    await vi.advanceTimersByTimeAsync(500);
    expect(controller.capturedImage()).not.toBeNull();
    expect(controller.state().reportId).toBe(id);
  });

  it('forgets the screenshot when the path changed', async () => {
    site.read.mockResolvedValue(page('https://example.com/'));
    controller.check('example.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    await controller.capture({ device: '', reload: false, section: '' });
    site.read.mockResolvedValue(page('https://example.com/pricing'));
    controller.sitePageChangedInPlace();
    await vi.advanceTimersByTimeAsync(500);
    expect(controller.capturedImage()).toBeNull();
  });

  it('goes back to checking when the visible site reaches a new page', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    controller.sitePageCommitted();
    expect(controller.state().status).toBe('checking');
  });

  it('explains data of the wrong shape', async () => {
    site.read.mockResolvedValue({});
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    expect(controller.state()).toMatchObject({
      status: 'failed',
      message: 'Could not read that page.',
    });
  });

  it('explains a read that failed', async () => {
    site.read.mockRejectedValue(new Error('gone'));
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    expect(controller.state().message).toBe('Could not read that page.');
  });

  it('keeps the first report when only the later read fails', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    site.read.mockRejectedValue(new Error('gone'));
    await vi.advanceTimersByTimeAsync(1500);
    expect(controller.state()).toMatchObject({ status: 'done', message: null });
    expect(controller.state().report).not.toBeNull();
  });
});

describe('when a page has problems', () => {
  it('shows when a page cannot open', () => {
    controller.check('a.com');
    controller.siteFailed(-105);
    expect(controller.state()).toMatchObject({
      status: 'failed',
      message: 'Could not open that page.',
      report: null,
    });
  });

  it('stays failed when the browser error page finishes loading', async () => {
    controller.check('a.invalid');
    controller.siteFailed(-105);
    controller.siteLoaded();
    await vi.advanceTimersByTimeAsync(1500);
    expect(site.read).not.toHaveBeenCalled();
    expect(controller.state().message).toBe('Could not open that page.');
  });

  it('ignores a load that was interrupted', () => {
    controller.check('a.com');
    controller.siteFailed(-3);
    expect(controller.state().status).toBe('checking');
  });

  it('says when a page takes too long, and shows what it can', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    await vi.advanceTimersByTimeAsync(30000);
    expect(site.read).toHaveBeenCalled();
    expect(controller.state()).toMatchObject({
      status: 'failed',
      message: 'That page took too long.',
    });
    expect(controller.state().report).not.toBeNull();
  });

  it('stops a page that takes too long, then reads it', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    await vi.advanceTimersByTimeAsync(30000);
    expect(site.stop).toHaveBeenCalledOnce();
    expect(site.stop.mock.invocationCallOrder[0]).toBeLessThan(
      site.read.mock.invocationCallOrder[0],
    );
  });

  it('keeps the warning if stopping the page also reports it loaded', async () => {
    site.stop.mockImplementation(() => controller.siteLoaded());
    controller.check('a.com');
    controller.sitePageCommitted();
    await vi.advanceTimersByTimeAsync(31600);
    expect(controller.state().message).toBe('That page took too long.');
  });

  it('gives up on a read that never answers', async () => {
    site.read.mockReturnValue(new Promise(() => undefined));
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    // The last re-read starts at 5000 ms, and gets its own 5000 ms.
    await vi.advanceTimersByTimeAsync(10000);
    expect(controller.state()).toMatchObject({
      status: 'failed',
      message: 'Could not read that page.',
    });
  });

  it('does not read an address change while the page is still loading', async () => {
    controller.check('a.com');
    controller.sitePageChangedInPlace();
    await flush();
    expect(site.read).not.toHaveBeenCalled();
    expect(controller.state().status).toBe('checking');
  });

  it('shows the old page nowhere when a new one never arrives', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    site.read.mockClear();

    controller.check('b.com');
    await vi.advanceTimersByTimeAsync(30000);
    expect(site.stop).toHaveBeenCalledOnce();
    expect(site.read).not.toHaveBeenCalled();
    expect(controller.state()).toMatchObject({
      status: 'failed',
      address: 'https://b.com',
      report: null,
      message: 'That page took too long.',
    });
  });

  it('loads the address again on refresh if it never arrived', async () => {
    controller.check('b.com');
    await vi.advanceTimersByTimeAsync(30000);
    site.load.mockClear();
    controller.refresh();
    expect(site.load).toHaveBeenCalledExactlyOnceWith('https://b.com');
    expect(site.reload).not.toHaveBeenCalled();
  });

  it('ignores a late finish from the previous page', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    site.read.mockClear();

    controller.check('b.com');
    controller.siteLoaded();
    await flush();
    expect(site.read).not.toHaveBeenCalled();
    expect(controller.state().status).toBe('checking');
  });

  it('leaves the report alone when a click goes nowhere', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    controller.siteCancelled();
    expect(controller.state().status).toBe('done');
    expect(controller.state().report).not.toBeNull();
  });

  it('says a checked address could not open if it was cancelled', () => {
    controller.check('a.com/file.zip');
    controller.siteCancelled();
    expect(controller.state()).toMatchObject({
      status: 'failed',
      message: 'Could not open that page.',
    });
  });

  it('reads again after a single-page site has had time to update', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await vi.advanceTimersByTimeAsync(1500);
    site.read.mockClear();
    controller.sitePageChangedInPlace();
    await vi.advanceTimersByTimeAsync(500);
    expect(site.read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(site.read).toHaveBeenCalledTimes(2);
  });

  it('does not time out once loaded', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await vi.advanceTimersByTimeAsync(30000);
    expect(controller.state().status).toBe('done');
  });
});

describe('refreshing', () => {
  it('does nothing with no page loaded', () => {
    controller.refresh();
    expect(site.reload).not.toHaveBeenCalled();
  });

  it('reloads and goes back to checking', async () => {
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
    controller.refresh();
    expect(site.reload).toHaveBeenCalledOnce();
    expect(controller.state().status).toBe('checking');
  });
});

describe('showing the site in the app', () => {
  it('shows the checked page and says so', () => {
    controller.check('a.com');
    controller.setSiteVisible(true);
    expect(viewer.show).toHaveBeenCalledExactlyOnceWith('https://a.com');
    expect(send.mock.lastCall?.[0].siteVisible).toBe(true);
  });

  it('has nothing to show before a check', () => {
    controller.setSiteVisible(true);
    expect(viewer.show).not.toHaveBeenCalled();
    expect(controller.state().siteVisible).toBe(false);
  });

  it('hides it', () => {
    controller.check('a.com');
    controller.setSiteVisible(true);
    controller.setSiteVisible(false);
    expect(viewer.hide).toHaveBeenCalledOnce();
    expect(controller.state().siteVisible).toBe(false);
  });

  it('follows a new check while open', () => {
    controller.check('a.com');
    controller.setSiteVisible(true);
    controller.check('b.com');
    expect(viewer.show).toHaveBeenLastCalledWith('https://b.com');
  });

  it('stays closed for a new check while hidden', () => {
    controller.check('a.com');
    expect(viewer.show).not.toHaveBeenCalled();
  });

  it('never reads the page or touches the Chrome tab', () => {
    controller.check('a.com');
    site.load.mockClear();
    controller.setSiteVisible(true);
    expect(site.load).not.toHaveBeenCalled();
    expect(site.read).not.toHaveBeenCalled();
  });

  it('notices when the site window hides itself', () => {
    controller.check('a.com');
    controller.setSiteVisible(true);
    controller.siteHidden();
    expect(send.mock.lastCall?.[0].siteVisible).toBe(false);
  });
});

describe('closing', () => {
  it('sends nothing after dispose', async () => {
    let finish!: (data: PageData) => void;
    site.read.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    controller.check('a.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    controller.dispose();
    send.mockClear();

    finish(page('https://a.com/'));
    await vi.advanceTimersByTimeAsync(30000);
    expect(send).not.toHaveBeenCalled();
    expect(site.read).toHaveBeenCalledTimes(1);
  });
});

describe('checking in Chrome', () => {
  const inChrome = async () => {
    controller.check('example.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
  };

  it('refuses while Chrome is not connected', () => {
    controller.setChromeConnected(false);
    expect(() => controller.check('example.com')).toThrow(
      new UserError('Chrome not connected.'),
    );
    expect(site.load).not.toHaveBeenCalled();
  });

  it('reads a third time, 5 seconds after loading', async () => {
    await inChrome();
    await vi.advanceTimersByTimeAsync(1500);
    expect(site.read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3500);
    expect(site.read).toHaveBeenCalledTimes(3);
  });

  it('cancels the late read for a new check', async () => {
    await inChrome();
    controller.check('other.com');
    site.read.mockClear();
    await vi.advanceTimersByTimeAsync(10000);
    expect(site.read).not.toHaveBeenCalled();
  });

  it('cancels the late read when the page fails', async () => {
    await inChrome();
    controller.siteClosed();
    site.read.mockClear();
    await vi.advanceTimersByTimeAsync(10000);
    expect(site.read).not.toHaveBeenCalled();
  });

  it('keeps the report when the late read fails', async () => {
    await inChrome();
    await vi.advanceTimersByTimeAsync(1500);
    site.read.mockRejectedValue(new Error('gone'));
    await vi.advanceTimersByTimeAsync(3500);
    expect(controller.state()).toMatchObject({ status: 'done' });
    expect(controller.state().report).not.toBeNull();
  });

  it('schedules the late read again after an in-place change', async () => {
    await inChrome();
    await vi.advanceTimersByTimeAsync(4000);
    site.read.mockClear();
    controller.sitePageChangedInPlace();
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    // The old late read, due at 5 seconds, was replaced.
    expect(site.read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(site.read).toHaveBeenCalledTimes(3);
  });

  it('says the tab was closed', async () => {
    await inChrome();
    controller.siteClosed();
    expect(controller.state()).toMatchObject({
      status: 'failed',
      report: null,
      message: 'The Chrome tab was closed.',
    });
  });

  it('ends the check and clears the cards when Chrome disconnects', async () => {
    await inChrome();
    controller.setChromeConnected(false);
    expect(controller.state()).toMatchObject({
      status: 'failed',
      report: null,
      message: 'Chrome not connected.',
      chromeConnected: false,
    });
  });

  it('drops the not-connected message once Chrome is back', async () => {
    await inChrome();
    controller.setChromeConnected(false);
    controller.setChromeConnected(true);
    expect(controller.state()).toMatchObject({
      message: null,
      chromeConnected: true,
    });
  });

  it('ignores an answer that arrives after Chrome disconnected', async () => {
    controller.check('example.com');
    controller.sitePageCommitted();
    let answer: (value: unknown) => void = () => undefined;
    site.read.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)),
    );
    controller.siteLoaded();
    controller.setChromeConnected(false);
    answer(page('https://example.com/'));
    await flush();
    expect(controller.state()).toMatchObject({
      status: 'failed',
      report: null,
    });
  });

  it('refreshes to a message while Chrome is not connected', async () => {
    await inChrome();
    controller.setChromeConnected(false);
    site.reload.mockClear();
    controller.refresh();
    expect(site.reload).not.toHaveBeenCalled();
    expect(controller.state().message).toBe('Chrome not connected.');
  });

  it('goes to the tab', async () => {
    await inChrome();
    expect(controller.goToTab()).toBe(true);
    expect(site.goToTab).toHaveBeenCalledOnce();
  });

  it('does not go to a tab before a check', () => {
    expect(controller.goToTab()).toBe(false);
    expect(site.goToTab).not.toHaveBeenCalled();
  });

  it('shows a link on the page', async () => {
    await inChrome();
    await expect(controller.showLink(2, 'https://a.com/')).resolves.toBe(
      'shown',
    );
    expect(site.showLink).toHaveBeenCalledWith(2, 'https://a.com/');
  });

  it('turns an odd or failed answer into null', async () => {
    await inChrome();
    site.showLink.mockResolvedValueOnce('nonsense');
    await expect(controller.showLink(0, 'https://a.com/')).resolves.toBeNull();
    site.showLink.mockRejectedValueOnce(new Error('no-answer'));
    await expect(controller.showLink(0, 'https://a.com/')).resolves.toBeNull();
  });

  it('does not show a link before a check', async () => {
    await expect(controller.showLink(0, 'https://a.com/')).resolves.toBeNull();
    expect(site.showLink).not.toHaveBeenCalled();
  });

  it('opens links in Chrome', async () => {
    await inChrome();
    expect(controller.openLinks(['https://a.com/'])).toBe(true);
    expect(site.openTabs).toHaveBeenCalledWith(['https://a.com/']);
    expect(controller.openLinks([])).toBe(false);
  });
});

describe('counting checks', () => {
  it('counts each check that starts', () => {
    expect(controller.checkCount()).toBe(0);
    controller.check('example.com');
    expect(controller.checkCount()).toBe(1);
  });

  it('does not count a refused address', () => {
    expect(() => controller.check('file:///x')).toThrow();
    expect(controller.checkCount()).toBe(0);
  });

  it('starts a new check even while the last one is still checking', () => {
    controller.check('a.com');
    controller.check('b.com');
    expect(site.load).toHaveBeenLastCalledWith('https://b.com');
    expect(controller.state()).toMatchObject({
      status: 'checking',
      address: 'https://b.com',
    });
  });
});

describe('taking a screenshot', () => {
  const DESKTOP_SIZE = { device: '', reload: false, section: '' };
  const checked = async () => {
    controller.check('example.com');
    controller.sitePageCommitted();
    controller.siteLoaded();
    await flush();
  };

  it('needs a checked page', async () => {
    await expect(controller.capture(DESKTOP_SIZE)).rejects.toThrow(
      'Check a page first.',
    );
    expect(site.capture).not.toHaveBeenCalled();
  });

  it('keeps the picture for saving', async () => {
    await checked();
    await expect(controller.capture(DESKTOP_SIZE)).resolves.toEqual({
      dataUrl: SHOT.dataUrl,
      stitched: false,
      stitchReason: null,
      device: '',
      section: '',
      matches: null,
    });
    expect(controller.capturedImage()?.dataUrl).toBe(SHOT.dataUrl);
  });

  it('asks Chrome for the picked size and keeps its name', async () => {
    await checked();
    const size = { device: 'iPhone 16', reload: true, section: '' };
    await expect(controller.capture(size)).resolves.toMatchObject({
      device: 'iPhone 16',
    });
    expect(site.capture).toHaveBeenCalledWith(size);
  });

  it('says when Chrome would not show the page as a device', async () => {
    await checked();
    site.capture.mockResolvedValueOnce({ error: 'no-device' });
    await expect(controller.capture(DESKTOP_SIZE)).rejects.toThrow(
      'or choose Desktop',
    );
  });

  it('asks for the section without the spaces around it, and keeps it', async () => {
    await checked();
    site.capture.mockResolvedValueOnce({ ...SHOT, matches: 3 });
    await expect(
      controller.capture({ ...DESKTOP_SIZE, section: '  .pricing ' }),
    ).resolves.toMatchObject({ section: '.pricing', matches: 3 });
    expect(site.capture).toHaveBeenCalledWith({
      ...DESKTOP_SIZE,
      section: '.pricing',
    });
  });

  it('ignores a match count for the whole page', async () => {
    await checked();
    site.capture.mockResolvedValueOnce({ ...SHOT, matches: 3 });
    await expect(controller.capture(DESKTOP_SIZE)).resolves.toMatchObject({
      section: '',
      matches: null,
    });
  });

  it.each([
    ['no-section', 'Nothing on the page matches .pricing.'],
    ['bad-selector', "That isn't a CSS selector."],
    ['empty-section', "The element matching .pricing isn't shown on the page."],
  ])('explains %s, naming the section', async (error, text) => {
    await checked();
    site.capture.mockResolvedValueOnce({ error });
    await expect(
      controller.capture({ ...DESKTOP_SIZE, section: '.pricing' }),
    ).rejects.toThrow(text);
    expect(controller.capturedImage()).toBeNull();
  });

  it('says when it was stitched', async () => {
    await checked();
    site.capture.mockResolvedValueOnce({
      ...SHOT,
      method: 'stitched',
      reason: 'Cannot attach',
    });
    await expect(controller.capture(DESKTOP_SIZE)).resolves.toMatchObject({
      stitched: true,
      stitchReason: 'Cannot attach',
    });
  });

  it.each([
    [{ dataUrl: 'data:image/png;base64,AAAA', method: 'debugger' }],
    [{ dataUrl: 'https://evil.example/x.jpg', method: 'debugger' }],
    [null],
  ])('refuses anything but a JPEG', async (answer) => {
    await checked();
    site.capture.mockResolvedValueOnce(answer);
    await expect(controller.capture(DESKTOP_SIZE)).rejects.toThrow(
      'Could not take the screenshot.',
    );
    expect(controller.capturedImage()).toBeNull();
  });

  it('explains why Chrome refused', async () => {
    await checked();
    site.capture.mockResolvedValueOnce({ error: 'devtools-open' });
    await expect(controller.capture(DESKTOP_SIZE)).rejects.toThrow(UserError);
    site.capture.mockResolvedValueOnce({ error: 'devtools-open' });
    await expect(controller.capture(DESKTOP_SIZE)).rejects.toThrow(
      'Close DevTools',
    );
  });

  it('says when Chrome was hidden and stopped drawing', async () => {
    await checked();
    site.capture.mockResolvedValueOnce({ error: 'not-drawn' });
    await expect(controller.capture(DESKTOP_SIZE)).rejects.toThrow(
      'Bring Chrome to the front',
    );
  });

  it('forgets the picture when a new page starts', async () => {
    await checked();
    await controller.capture(DESKTOP_SIZE);
    controller.refresh();
    expect(controller.capturedImage()).toBeNull();
  });

  it('drops a picture of a page that changed meanwhile', async () => {
    await checked();
    let answer: (value: unknown) => void = () => undefined;
    site.capture.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const taking = controller.capture(DESKTOP_SIZE);
    controller.check('other.com');
    answer(SHOT);
    await expect(taking).rejects.toThrow('The page changed');
    expect(controller.capturedImage()).toBeNull();
  });
});
