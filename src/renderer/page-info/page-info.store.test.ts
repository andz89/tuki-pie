import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type { PageInfoUpdate } from '../../shared/types';
import { pageInfoBridge } from './page-info-bridge';
import { NO_SCREENSHOT, usePageInfoStore } from './page-info.store';

vi.mock('./page-info-bridge', () => ({
  pageInfoBridge: {
    getState: vi.fn(),
    check: vi.fn(),
    refresh: vi.fn(),
    setSiteVisible: vi.fn(),
    goToTab: vi.fn(),
    setLinkFilter: vi.fn(),
    onUpdate: vi.fn(),
    capture: vi.fn(),
    saveCapture: vi.fn(),
    copyCapture: vi.fn(),
    settings: { get: vi.fn() },
  },
}));

const update = (changes: Partial<PageInfoUpdate>): PageInfoUpdate => ({
  status: 'idle',
  address: null,
  report: null,
  message: null,
  siteVisible: false,
  chromeConnected: false,
  reportId: 0,
  ...changes,
});

const store = () => usePageInfoStore.getState();
const OK = { ok: true, value: undefined } as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(pageInfoBridge.getState).mockResolvedValue({
    ok: true,
    value: update({}),
  });
  vi.mocked(pageInfoBridge.onUpdate).mockReturnValue(() => undefined);
  usePageInfoStore.setState({
    update: update({}),
    problem: null,
    screenshot: NO_SCREENSHOT,
    captureSize: { device: '', reload: false },
  });
});

describe('the Page Info store', () => {
  it('loads the current state on start', async () => {
    vi.mocked(pageInfoBridge.getState).mockResolvedValue({
      ok: true,
      value: update({ status: 'checking', address: 'https://a.com' }),
    });
    await store().start();
    expect(store().update.address).toBe('https://a.com');
  });

  it('applies later updates', async () => {
    await store().start();
    const [listener] = vi.mocked(pageInfoBridge.onUpdate).mock.calls[0];
    listener(update({ status: 'done' }));
    expect(store().update.status).toBe('done');
  });

  it('shows why a check was refused', async () => {
    vi.mocked(pageInfoBridge.check).mockResolvedValue({
      ok: false,
      error: 'Enter a web address, like example.com.',
    });
    await store().check('file:///x');
    expect(store().problem).toBe('Enter a web address, like example.com.');
  });

  it('clears the problem after a good check', async () => {
    usePageInfoStore.setState({ problem: 'old' });
    vi.mocked(pageInfoBridge.check).mockResolvedValue(OK);
    await store().check('a.com');
    expect(store().problem).toBeNull();
  });

  it('asks for the opposite of what is showing', async () => {
    usePageInfoStore.setState({ update: update({ siteVisible: true }) });
    vi.mocked(pageInfoBridge.setSiteVisible).mockResolvedValue(OK);
    await store().toggleSite();
    expect(pageInfoBridge.setSiteVisible).toHaveBeenCalledExactlyOnceWith(
      false,
    );
  });

  it('refreshes', async () => {
    vi.mocked(pageInfoBridge.refresh).mockResolvedValue(OK);
    await store().refresh();
    expect(pageInfoBridge.refresh).toHaveBeenCalledOnce();
  });
});

describe('Link filters', () => {
  const filter = { off: ['nonce'], words: [], tokens: true };

  it('shows a change at once and saves it', async () => {
    usePageInfoStore.setState({ settings: DEFAULT_SETTINGS });
    let finish: (value: {
      ok: true;
      value: typeof DEFAULT_SETTINGS;
    }) => void = () => undefined;
    vi.mocked(pageInfoBridge.setLinkFilter).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const saving = store().setLinkFilter(filter);
    expect(JSON.parse(store().settings.linkFilter)).toEqual(filter);
    expect(pageInfoBridge.setLinkFilter).toHaveBeenCalledWith(filter);
    const saved = { ...DEFAULT_SETTINGS, linkFilter: JSON.stringify(filter) };
    finish({ ok: true, value: saved });
    await saving;
    expect(store().settings).toEqual(saved);
  });
});

describe('the Screenshot tab', () => {
  const SHOT = {
    dataUrl: 'data:image/jpeg;base64,AAAA',
    width: 1280,
    height: 9000,
    bytes: 3,
    stitched: false,
    stitchReason: null,
    device: '',
  };
  const REPORT = {} as NonNullable<PageInfoUpdate['report']>;
  const checked = update({
    status: 'done',
    address: 'https://a.com/',
    report: REPORT,
  });

  const listen = async () => {
    await store().start();
    const [listener] = vi.mocked(pageInfoBridge.onUpdate).mock.calls[0];
    listener(checked);
    return listener;
  };

  it('takes nothing until asked', async () => {
    await listen();
    expect(pageInfoBridge.capture).not.toHaveBeenCalled();
    expect(store().screenshot.status).toBe('none');
  });

  it('keeps the picture once taken', async () => {
    vi.mocked(pageInfoBridge.capture).mockResolvedValue({
      ok: true,
      value: SHOT,
    });
    await store().takeScreenshot();
    expect(pageInfoBridge.capture).toHaveBeenCalledOnce();
    expect(store().screenshot).toMatchObject({ status: 'done', shot: SHOT });
  });

  it('asks for the size picked in the menu', async () => {
    vi.mocked(pageInfoBridge.capture).mockResolvedValue({
      ok: true,
      value: SHOT,
    });
    store().setCaptureSize({ device: 'Pixel 9' });
    store().setCaptureSize({ reload: true });
    await store().takeScreenshot();
    expect(pageInfoBridge.capture).toHaveBeenCalledWith({
      device: 'Pixel 9',
      reload: true,
    });
  });

  it('asks only once while one is being taken', async () => {
    vi.mocked(pageInfoBridge.capture).mockResolvedValue({
      ok: true,
      value: SHOT,
    });
    await Promise.all([store().takeScreenshot(), store().takeScreenshot()]);
    expect(pageInfoBridge.capture).toHaveBeenCalledOnce();
  });

  it('shows why it failed and keeps the last picture', async () => {
    usePageInfoStore.setState({
      screenshot: { ...NO_SCREENSHOT, status: 'done', shot: SHOT },
    });
    vi.mocked(pageInfoBridge.capture).mockResolvedValue({
      ok: false,
      error: 'Close DevTools (F12) on this tab, then try again.',
    });
    await store().takeScreenshot();
    expect(store().screenshot).toMatchObject({
      status: 'done',
      shot: SHOT,
      problem: 'Close DevTools (F12) on this tab, then try again.',
    });
  });

  it('keeps the picture through re-reads of the same page', async () => {
    const listener = await listen();
    usePageInfoStore.setState({
      screenshot: { ...NO_SCREENSHOT, status: 'done', shot: SHOT },
    });
    listener({ ...checked });
    expect(store().screenshot.shot).toBe(SHOT);
  });

  it.each([
    ['a refresh', update({ status: 'checking', address: 'https://a.com/' })],
    [
      'another page',
      update({ status: 'done', address: 'https://b.com/', report: REPORT }),
    ],
  ])('forgets the picture on %s', async (_name, next) => {
    const listener = await listen();
    usePageInfoStore.setState({
      screenshot: { ...NO_SCREENSHOT, status: 'done', shot: SHOT },
    });
    listener(next);
    expect(store().screenshot).toEqual(NO_SCREENSHOT);
  });

  it('does not bring back the old picture when the page changed mid-capture', async () => {
    const listener = await listen();
    usePageInfoStore.setState({
      screenshot: { ...NO_SCREENSHOT, status: 'done', shot: SHOT },
    });
    vi.mocked(pageInfoBridge.capture).mockImplementation(async () => {
      listener(
        update({ status: 'done', address: 'https://b.com/', report: REPORT }),
      );
      return { ok: false, error: 'The page changed. Try again.' };
    });
    await store().takeScreenshot();
    expect(store().screenshot).toMatchObject({
      status: 'none',
      shot: null,
      problem: 'The page changed. Try again.',
    });
  });

  it('says where Save put it', async () => {
    vi.mocked(pageInfoBridge.saveCapture).mockResolvedValue(OK);
    await store().saveScreenshot();
    expect(store().screenshot.notice).toBe('Saved to Pictures\\Pie Launcher.');
  });
});
