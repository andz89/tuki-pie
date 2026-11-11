import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteEventName } from './chrome-bridge';
import { CAPTURE_MS, ERROR_FAILED, createChromeSite } from './chrome-site';
import type { ChromeSiteEvents } from './chrome-site';

let emit: (name: SiteEventName) => void;
let stopListening: ReturnType<typeof vi.fn>;
let bridge: {
  request: ReturnType<typeof vi.fn>;
  onEvent: ReturnType<typeof vi.fn>;
};
let events: { [Key in keyof ChromeSiteEvents]: ReturnType<typeof vi.fn> };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  stopListening = vi.fn();
  bridge = {
    request: vi.fn(async () => null),
    onEvent: vi.fn((listener) => {
      emit = listener;
      return stopListening;
    }),
  };
  events = {
    committed: vi.fn(),
    loaded: vi.fn(),
    changedInPlace: vi.fn(),
    failed: vi.fn(),
    cancelled: vi.fn(),
    closed: vi.fn(),
  };
});

const site = () =>
  createChromeSite(
    bridge as unknown as Parameters<typeof createChromeSite>[0],
    events as unknown as ChromeSiteEvents,
  );

describe('the Chrome site', () => {
  it.each([
    ['load', ['open', { url: 'https://a.com' }]],
    ['reload', ['reload', undefined]],
    ['stop', ['stop']],
    ['goToTab', ['goToTab']],
  ] as const)('sends %s as a fixed action', (method, call) => {
    const chrome = site();
    if (method === 'load') chrome.load('https://a.com');
    else chrome[method]();
    expect(bridge.request).toHaveBeenCalledExactlyOnceWith(...call);
  });

  it('reads through the bridge', async () => {
    bridge.request.mockResolvedValueOnce({ url: 'x' });
    await expect(site().read()).resolves.toEqual({ url: 'x' });
    expect(bridge.request).toHaveBeenCalledWith('read');
  });

  it('counts a refused open as a failed page', async () => {
    bridge.request.mockRejectedValueOnce(new Error('not-web'));
    site().load('https://a.com');
    await flush();
    expect(events.failed).toHaveBeenCalledExactlyOnceWith(ERROR_FAILED);
  });

  it('never fails a page over a stop that went nowhere', async () => {
    bridge.request.mockRejectedValueOnce(new Error('no-tab'));
    site().stop();
    await flush();
    expect(events.failed).not.toHaveBeenCalled();
  });

  it('passes each event on', () => {
    site();
    emit('committed');
    emit('loaded');
    emit('changedInPlace');
    emit('cancelled');
    emit('closed');
    emit('failed');
    expect(events.committed).toHaveBeenCalledOnce();
    expect(events.loaded).toHaveBeenCalledOnce();
    expect(events.changedInPlace).toHaveBeenCalledOnce();
    expect(events.cancelled).toHaveBeenCalledOnce();
    expect(events.closed).toHaveBeenCalledOnce();
    expect(events.failed).toHaveBeenCalledWith(ERROR_FAILED);
  });

  it('asks the extension to show a link', async () => {
    bridge.request.mockResolvedValueOnce('shown');
    await expect(site().showLink(2, 'https://a.com/')).resolves.toBe('shown');
    expect(bridge.request).toHaveBeenCalledWith('showLink', {
      index: 2,
      href: 'https://a.com/',
    });
  });

  it('opens links without failing the page', async () => {
    bridge.request.mockRejectedValueOnce(new Error('no-answer'));
    site().openTabs(['https://a.com/']);
    await flush();
    expect(bridge.request).toHaveBeenCalledWith('openTabs', {
      urls: ['https://a.com/'],
    });
    expect(events.failed).not.toHaveBeenCalled();
  });

  it('stops listening when destroyed', () => {
    site().destroy();
    expect(stopListening).toHaveBeenCalledOnce();
  });

  it('gives a screenshot longer than other requests', async () => {
    bridge.request.mockResolvedValueOnce({ dataUrl: 'x' });
    const size = { device: 'iPhone 16', reload: false };
    await expect(site().capture(size)).resolves.toEqual({ dataUrl: 'x' });
    expect(bridge.request).toHaveBeenCalledWith('capture', size, CAPTURE_MS);
  });
});
