import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMMAND_MS,
  MAX_CAPTURE_HEIGHT,
  MAX_IMAGE_HEIGHT,
  SCROLL_PAUSE_MS,
  STALE_RETRIES,
  clipBox,
  createCapture,
  fitScale,
  pageScrollState,
  pageScrollTo,
  scrollThrough,
  sectionBox,
} from './capture.js';

interface FakeTab {
  id: number;
  active: boolean;
  windowId: number;
}

let tabs: FakeTab[];
let targets: { tabId: number; attached: boolean; extensionId?: string }[];
let commands: Record<string, unknown>;
let windowState: string;
type Listener = (...args: never[]) => void;
const updated = new Set<Listener>();
const debuggerEvents = new Set<Listener>();

function fakeChrome() {
  return {
    tabs: {
      get: vi.fn(async (id: number) => {
        const tab = tabs.find((each) => each.id === id);
        if (!tab) throw new Error('No tab');
        return tab;
      }),
      query: vi.fn(async () => tabs.filter((tab) => tab.active)),
      update: vi.fn(async (id: number, changes: Partial<FakeTab>) => {
        for (const tab of tabs) {
          tab.active = tab.id === id ? Boolean(changes.active) : false;
        }
      }),
      captureVisibleTab: vi.fn(async () => 'data:image/png;base64,AA=='),
      // Reloading finishes at once.
      reload: vi.fn(async (id: number) => {
        for (const listener of updated) listener(id, { status: 'complete' });
      }),
      onUpdated: {
        addListener: vi.fn((listener: Listener) => updated.add(listener)),
        removeListener: vi.fn((listener: Listener) => updated.delete(listener)),
      },
    },
    runtime: { id: 'pie' },
    windows: {
      update: vi.fn(async () => undefined),
      get: vi.fn(async (id: number) => ({ id, state: windowState })),
    },
    scripting: {
      // Every page script answers as a one-screen page.
      executeScript: vi.fn(async () => [
        {
          result: {
            y: 0,
            viewportWidth: 1000,
            viewportHeight: 800,
            contentWidth: 1000,
            pageHeight: 800,
          },
        },
      ]),
    },
    debugger: {
      attach: vi.fn(async () => undefined),
      detach: vi.fn(async () => undefined),
      getTargets: vi.fn(async () => targets),
      sendCommand: vi.fn(async (target: { tabId: number }, method: string) => {
        if (method === 'Page.reload') {
          for (const listener of debuggerEvents) {
            listener(target, 'Page.loadEventFired');
          }
        }
        return commands[method];
      }),
      onEvent: {
        addListener: vi.fn((listener: Listener) =>
          debuggerEvents.add(listener),
        ),
        removeListener: vi.fn((listener: Listener) =>
          debuggerEvents.delete(listener),
        ),
      },
    },
  };
}

let chrome: ReturnType<typeof fakeChrome>;

beforeEach(() => {
  tabs = [
    { id: 1, active: true, windowId: 7 },
    { id: 2, active: false, windowId: 7 },
  ];
  targets = [];
  windowState = 'normal';
  commands = {
    'Page.getLayoutMetrics': { cssContentSize: { width: 1280, height: 4000 } },
    'Runtime.evaluate': { result: { value: 1 } },
    'Page.captureScreenshot': { data: 'JPEGDATA' },
  };
  updated.clear();
  debuggerEvents.clear();
  chrome = fakeChrome();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('capturing through the debugger', () => {
  it('sends only the picture and how it was taken', async () => {
    const shot = await createCapture({ chrome }).capture(1);
    expect(shot).toEqual({
      dataUrl: 'data:image/jpeg;base64,JPEGDATA',
      method: 'debugger',
    });
  });

  it('asks for one full-page JPEG and detaches', async () => {
    const shot = await createCapture({ chrome }).capture(1);
    expect(shot).toMatchObject({
      dataUrl: 'data:image/jpeg;base64,JPEGDATA',
      method: 'debugger',
    });
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 1 },
      'Page.captureScreenshot',
      {
        format: 'jpeg',
        quality: 80,
        clip: { x: 0, y: 0, width: 1280, height: 4000, scale: 1 },
      },
    );
    expect(chrome.debugger.detach).toHaveBeenCalledWith({ tabId: 1 });
  });

  it('draws the whole page by making the view as tall as the page', async () => {
    await createCapture({ chrome }).capture(1);
    const methods = chrome.debugger.sendCommand.mock.calls.map(
      ([, method]) => method,
    );
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 1 },
      'Emulation.setDeviceMetricsOverride',
      { width: 1280, height: 4000, deviceScaleFactor: 0, mobile: false },
    );
    // Back to its own size afterwards, after the picture.
    expect(
      methods.indexOf('Emulation.clearDeviceMetricsOverride'),
    ).toBeGreaterThan(methods.indexOf('Page.captureScreenshot'));
  });

  it('puts the size back even when the capture fails', async () => {
    chrome.debugger.sendCommand.mockImplementation(
      async (_target: unknown, method: string) => {
        if (method === 'Page.captureScreenshot') throw new Error('boom');
        return commands[method];
      },
    );
    await createCapture({ chrome }).capture(1);
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 1 },
      'Emulation.clearDeviceMetricsOverride',
      undefined,
    );
  });

  it('measures again when the page grows with the taller view', async () => {
    let calls = 0;
    chrome.debugger.sendCommand.mockImplementation(
      async (_target: unknown, method: string) => {
        if (method === 'Page.getLayoutMetrics') {
          calls += 1;
          return {
            cssContentSize: { width: 1280, height: calls === 1 ? 4000 : 4600 },
          };
        }
        return commands[method];
      },
    );
    await createCapture({ chrome }).capture(1);
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 1 },
      'Page.captureScreenshot',
      expect.objectContaining({
        clip: { x: 0, y: 0, width: 1280, height: 4600, scale: 1 },
      }),
    );
  });

  it('scales a very tall page under the cap', async () => {
    commands['Page.getLayoutMetrics'] = {
      cssContentSize: { width: 1000, height: 40000 },
    };
    commands['Runtime.evaluate'] = { result: { value: 1.5 } };
    await createCapture({ chrome }).capture(1);
    const call = chrome.debugger.sendCommand.mock.calls.find(
      ([, method]) => method === 'Page.captureScreenshot',
    );
    const params = call?.[2] as unknown as { clip: { scale: number } };
    expect(40000 * 1.5 * params.clip.scale).toBeCloseTo(MAX_IMAGE_HEIGHT);
  });

  it('never makes the view taller than the cap, however long the page', async () => {
    commands['Page.getLayoutMetrics'] = {
      cssContentSize: { width: 1280, height: 500000 },
    };
    await createCapture({ chrome }).capture(1);
    const heights = chrome.debugger.sendCommand.mock.calls
      .filter(([, method]) => method === 'Emulation.setDeviceMetricsOverride')
      .map(([, , params]) => (params as { height: number }).height);
    expect(Math.max(...heights)).toBeLessThanOrEqual(MAX_CAPTURE_HEIGHT);
    const shot = chrome.debugger.sendCommand.mock.calls.find(
      ([, method]) => method === 'Page.captureScreenshot',
    );
    const params = shot?.[2] as { clip: { height: number } } | undefined;
    expect(params?.clip.height).toBeLessThanOrEqual(MAX_CAPTURE_HEIGHT);
  });

  it('detaches first when a command hangs, instead of waiting on cleanup', async () => {
    vi.useFakeTimers();
    try {
      chrome.debugger.sendCommand.mockImplementation(
        async (_target: unknown, method: string) =>
          method === 'Page.captureScreenshot' ||
          method === 'Emulation.clearDeviceMetricsOverride'
            ? new Promise(() => undefined)
            : commands[method],
      );
      const taking = createCapture({ chrome }).capture(1);
      await vi.advanceTimersByTimeAsync(COMMAND_MS + 5000);
      await expect(taking).resolves.toMatchObject({ error: 'timeout' });
      expect(chrome.debugger.detach).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('detaches even when the capture fails', async () => {
    chrome.debugger.sendCommand.mockRejectedValue(new Error('boom'));
    await createCapture({ chrome }).capture(1);
    expect(chrome.debugger.detach).toHaveBeenCalled();
  });

  it('brings the Chrome window to the front, so the page draws at full speed', async () => {
    await createCapture({ chrome }).capture(1);
    expect(chrome.windows.update).toHaveBeenCalledWith(7, { focused: true });
  });

  it('opens a minimized Chrome window for the capture, then minimizes it again', async () => {
    windowState = 'minimized';
    await createCapture({ chrome }).capture(1);
    expect(chrome.windows.update).toHaveBeenNthCalledWith(1, 7, {
      state: 'normal',
      focused: true,
    });
    expect(chrome.windows.update).toHaveBeenLastCalledWith(7, {
      state: 'minimized',
    });
  });

  it('brings a background tab forward and puts yours back', async () => {
    await createCapture({ chrome }).capture(2);
    expect(chrome.tabs.update).toHaveBeenNthCalledWith(1, 2, { active: true });
    expect(chrome.tabs.update).toHaveBeenLastCalledWith(1, { active: true });
  });
});

describe('capturing as a device', () => {
  const sent = () =>
    chrome.debugger.sendCommand.mock.calls.map(([, method, params]) => ({
      method,
      params,
    }));

  it('shows the page at the device width, as a touch phone', async () => {
    const shot = await createCapture({ chrome }).capture(1, {
      device: 'iPhone 16',
    });
    expect(shot).toMatchObject({ method: 'debugger' });
    expect(sent()).toContainEqual({
      method: 'Emulation.setDeviceMetricsOverride',
      params: { width: 393, height: 852, deviceScaleFactor: 1, mobile: true },
    });
    expect(sent()).toContainEqual({
      method: 'Emulation.setUserAgentOverride',
      params: { userAgent: expect.stringContaining('iPhone') },
    });
    expect(sent()).toContainEqual(
      expect.objectContaining({ method: 'Emulation.setTouchEmulationEnabled' }),
    );
    // As tall as the page, still the phone's width, one pixel per CSS pixel.
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 1 },
      'Page.captureScreenshot',
      expect.objectContaining({
        clip: { x: 0, y: 0, width: 393, height: 4000, scale: 1 },
      }),
    );
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });

  it('reloads as the device when asked, and back again after', async () => {
    await createCapture({ chrome }).capture(1, {
      device: 'Pixel 9',
      reload: true,
    });
    const methods = sent().map(({ method }) => method);
    expect(methods.indexOf('Page.reload')).toBeGreaterThan(
      methods.indexOf('Emulation.setUserAgentOverride'),
    );
    expect(methods.indexOf('Page.reload')).toBeLessThan(
      methods.indexOf('Page.captureScreenshot'),
    );
    // Once the debugger is gone, so the page loads as itself.
    expect(chrome.tabs.reload).toHaveBeenCalledExactlyOnceWith(1);
    expect(chrome.tabs.reload.mock.invocationCallOrder[0]).toBeGreaterThan(
      chrome.debugger.detach.mock.invocationCallOrder[0],
    );
  });

  it('never stitches the desktop page under a device name', async () => {
    chrome.debugger.attach.mockRejectedValue(new Error('Another debugger'));
    await expect(
      createCapture({ chrome }).capture(1, { device: 'iPhone 16' }),
    ).resolves.toMatchObject({ error: 'no-device' });
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('says DevTools is in the way when it is', async () => {
    chrome.debugger.attach.mockRejectedValue(new Error('Another debugger'));
    targets = [{ tabId: 1, attached: true }];
    await expect(
      createCapture({ chrome }).capture(1, { device: 'iPhone 16' }),
    ).resolves.toMatchObject({ error: 'devtools-open' });
  });

  it('refuses a device it does not know', async () => {
    await expect(
      createCapture({ chrome }).capture(1, { device: 'toString' }),
    ).resolves.toMatchObject({ error: 'failed' });
    expect(chrome.debugger.attach).not.toHaveBeenCalled();
  });
});

describe('capturing a section through the debugger', () => {
  // The page answers the section's measuring with `box`, and 1 otherwise.
  const pageWithSection = (box: unknown) => {
    chrome.debugger.sendCommand.mockImplementation(
      async (
        _target: unknown,
        method: string,
        params?: { expression?: string },
      ) => {
        if (
          method === 'Runtime.evaluate' &&
          params?.expression?.includes('querySelectorAll')
        ) {
          return { result: { value: box } };
        }
        return commands[method];
      },
    );
  };

  it('clips the picture to the first matching element', async () => {
    pageWithSection({ x: 40.5, y: 1200, width: 600, height: 300, matches: 3 });
    const shot = await createCapture({ chrome }).capture(1, {
      selector: '.pricing',
    });
    expect(shot).toEqual({
      dataUrl: 'data:image/jpeg;base64,JPEGDATA',
      method: 'debugger',
      matches: 3,
    });
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 1 },
      'Page.captureScreenshot',
      {
        format: 'jpeg',
        quality: 80,
        clip: { x: 40, y: 1200, width: 601, height: 300, scale: 1 },
      },
    );
  });

  it('passes the selector to the page as text, never as code', async () => {
    pageWithSection({ x: 0, y: 0, width: 10, height: 10, matches: 1 });
    await createCapture({ chrome }).capture(1, { selector: `'); alert(1)//` });
    const call = chrome.debugger.sendCommand.mock.calls.find(([, , params]) =>
      (params as { expression?: string } | undefined)?.expression?.includes(
        'querySelectorAll',
      ),
    );
    const params = call?.[2] as { expression: string } | undefined;
    expect(params?.expression).toMatch(/\)\("'\); alert\(1\)\/\/"\)$/);
  });

  it.each(['no-section', 'bad-selector', 'empty-section'])(
    'reports %s without stitching, and puts the page back',
    async (error) => {
      pageWithSection({ error });
      await expect(
        createCapture({ chrome }).capture(1, { selector: '.x' }),
      ).resolves.toEqual({ error });
      expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
      expect(chrome.debugger.sendCommand).not.toHaveBeenCalledWith(
        { tabId: 1 },
        'Page.captureScreenshot',
        expect.anything(),
      );
      expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
        { tabId: 1 },
        'Emulation.clearDeviceMetricsOverride',
        undefined,
      );
      expect(chrome.debugger.detach).toHaveBeenCalled();
    },
  );

  it('says a section below what could be drawn is not shown', async () => {
    pageWithSection({ x: 0, y: 9000, width: 100, height: 100, matches: 1 });
    await expect(
      createCapture({ chrome }).capture(1, { selector: '.x' }),
    ).resolves.toEqual({ error: 'empty-section' });
  });

  it('takes the whole page when the selector is only spaces', async () => {
    await createCapture({ chrome }).capture(1, { selector: '   ' });
    expect(chrome.debugger.sendCommand).toHaveBeenCalledWith(
      { tabId: 1 },
      'Page.captureScreenshot',
      expect.objectContaining({
        clip: { x: 0, y: 0, width: 1280, height: 4000, scale: 1 },
      }),
    );
  });
});

describe('clipBox', () => {
  it('rounds out to whole pixels', () => {
    expect(clipBox({ x: 1.5, y: 2.2, width: 3, height: 4 }, 100, 100)).toEqual({
      x: 1,
      y: 2,
      width: 4,
      height: 5,
    });
  });

  it('cuts the box to the picture', () => {
    expect(clipBox({ x: 80, y: 90, width: 50, height: 50 }, 100, 100)).toEqual({
      x: 80,
      y: 90,
      width: 20,
      height: 10,
    });
  });

  it('is null when none of the box is in the picture', () => {
    expect(clipBox({ x: 0, y: 200, width: 50, height: 50 }, 100, 100)).toBe(
      null,
    );
  });
});

describe('sectionBox', () => {
  const page = (elements: { rect: object }[], error = false) => {
    vi.stubGlobal('scrollX', 0);
    vi.stubGlobal('scrollY', 500);
    vi.stubGlobal('document', {
      documentElement: { scrollWidth: 1000, scrollHeight: 3000 },
      body: { scrollHeight: 3000 },
      querySelectorAll: () => {
        if (error) throw new Error('not a selector');
        return elements.map((each) => ({
          getBoundingClientRect: () => each.rect,
        }));
      },
    });
  };
  const rect = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    right: left + width,
    bottom: top + height,
  });

  it('gives the first match in page coordinates, and how many matched', () => {
    page([{ rect: rect(10, 100, 200, 50) }, { rect: rect(0, 0, 5, 5) }]);
    expect(sectionBox('.a')).toEqual({
      x: 10,
      y: 600,
      width: 200,
      height: 50,
      matches: 2,
    });
  });

  it('cuts an element wider than the page to the page', () => {
    page([{ rect: rect(-50, 0, 2000, 100) }]);
    expect(sectionBox('.a')).toMatchObject({ x: 0, width: 1000 });
  });

  it('says when nothing matches', () => {
    page([]);
    expect(sectionBox('.a')).toEqual({ error: 'no-section' });
  });

  it('says when the selector is not one', () => {
    page([], true);
    expect(sectionBox('..')).toEqual({ error: 'bad-selector' });
  });

  it('says when the element has no size', () => {
    page([{ rect: rect(10, 10, 0, 0) }]);
    expect(sectionBox('.a')).toEqual({ error: 'empty-section' });
  });
});

describe('a capture of ours that never detached', () => {
  it('is taken back, and the capture goes on in one pass', async () => {
    targets = [{ tabId: 1, attached: true, extensionId: 'pie' }];
    chrome.debugger.attach
      .mockRejectedValueOnce(new Error('Another debugger is already attached'))
      .mockResolvedValueOnce(undefined);
    const shot = await createCapture({ chrome }).capture(1);
    expect(shot).toMatchObject({ method: 'debugger' });
    expect(chrome.debugger.attach).toHaveBeenCalledTimes(2);
  });

  it('is never reported as another extension', async () => {
    targets = [{ tabId: 1, attached: true, extensionId: 'pie' }];
    chrome.debugger.attach.mockRejectedValue(new Error('still attached'));
    chrome.tabs.captureVisibleTab.mockRejectedValue(new Error('no'));
    await expect(createCapture({ chrome }).capture(1)).resolves.toMatchObject({
      error: 'not-allowed',
    });
  });
});

describe('when the debugger cannot attach', () => {
  beforeEach(() => {
    chrome.debugger.attach.mockRejectedValue(new Error('Another debugger'));
  });

  const stubCanvas = () => {
    vi.stubGlobal('fetch', async () => ({ blob: async () => new Blob() }));
    vi.stubGlobal('createImageBitmap', async () => ({
      width: 1000,
      height: 800,
      close: () => undefined,
    }));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return { drawImage: () => undefined };
        }
        async convertToBlob() {
          return new Blob(['x'], { type: 'image/jpeg' });
        }
      },
    );
  };

  // A page three screens tall that really scrolls.
  const tallPage = () => {
    let y = 0;
    chrome.scripting.executeScript.mockImplementation(
      async ({ args }: { args?: unknown[] }) => {
        if (typeof args?.[0] === 'number') y = args[0];
        return [
          {
            result: {
              y,
              viewportWidth: 1000,
              viewportHeight: 800,
              contentWidth: 1000,
              pageHeight: 2400,
            },
          },
        ];
      },
    );
  };

  it('stops when Chrome hands back the same screen after scrolling', async () => {
    vi.useFakeTimers();
    try {
      stubCanvas();
      tallPage();
      const taking = createCapture({ chrome }).capture(1);
      await vi.runAllTimersAsync();
      await expect(taking).resolves.toMatchObject({ error: 'not-drawn' });
      // The first screen, then the retries of the second.
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(
        1 + STALE_RETRIES + 1,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('stitches a page whose screens differ', async () => {
    vi.useFakeTimers();
    try {
      stubCanvas();
      tallPage();
      let n = 0;
      chrome.tabs.captureVisibleTab.mockImplementation(
        async () => `data:image/png;base64,${n++}`,
      );
      const taking = createCapture({ chrome }).capture(1);
      await vi.runAllTimersAsync();
      await expect(taking).resolves.toMatchObject({ method: 'stitched' });
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  // Bitmaps that report when they are made and closed.
  const trackBitmaps = () => {
    const events: string[] = [];
    let made = 0;
    vi.stubGlobal('createImageBitmap', async () => {
      const id = made++;
      events.push(`make ${id}`);
      return {
        width: 1000,
        height: 800,
        close: () => events.push(`close ${id}`),
      };
    });
    return events;
  };

  it('frees every screen it took when stitching fails partway', async () => {
    vi.useFakeTimers();
    try {
      stubCanvas();
      const events = trackBitmaps();
      tallPage();
      const taking = createCapture({ chrome }).capture(1);
      await vi.runAllTimersAsync();
      await expect(taking).resolves.toMatchObject({ error: 'not-drawn' });
      const made = events.filter((event) => event.startsWith('make')).length;
      const closed = events.filter((event) => event.startsWith('close')).length;
      expect(closed).toBe(made);
    } finally {
      vi.useRealTimers();
    }
  });

  it('draws and frees each screen before taking the next', async () => {
    vi.useFakeTimers();
    try {
      stubCanvas();
      const events = trackBitmaps();
      tallPage();
      let n = 0;
      chrome.tabs.captureVisibleTab.mockImplementation(
        async () => `data:image/png;base64,${n++}`,
      );
      const taking = createCapture({ chrome }).capture(1);
      await vi.runAllTimersAsync();
      await taking;
      expect(events).toEqual([
        'make 0',
        'close 0',
        'make 1',
        'close 1',
        'make 2',
        'close 2',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('makes the picture only as tall as what it could capture', async () => {
    vi.useFakeTimers();
    try {
      const sizes: number[][] = [];
      stubCanvas();
      const Canvas = globalThis.OffscreenCanvas as unknown as new (
        width: number,
        height: number,
      ) => object;
      vi.stubGlobal(
        'OffscreenCanvas',
        class extends (Canvas as new (w: number, h: number) => object) {
          constructor(width: number, height: number) {
            super(width, height);
            sizes.push([width, height]);
          }
        },
      );
      // Says it is three screens tall, but stops scrolling after one.
      chrome.scripting.executeScript.mockImplementation(
        async ({ args }: { args?: unknown[] }) => [
          {
            result: {
              y: typeof args?.[0] === 'number' ? Math.min(args[0], 800) : 0,
              viewportWidth: 1000,
              viewportHeight: 800,
              contentWidth: 1000,
              pageHeight: 2400,
            },
          },
        ],
      );
      let n = 0;
      chrome.tabs.captureVisibleTab.mockImplementation(
        async () => `data:image/png;base64,${n++}`,
      );
      const taking = createCapture({ chrome }).capture(1);
      await vi.runAllTimersAsync();
      await expect(taking).resolves.toMatchObject({ method: 'stitched' });
      expect(sizes.at(-1)).toEqual([1000, 1600]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stitches only the screens and columns of a section', async () => {
    vi.useFakeTimers();
    try {
      stubCanvas();
      const sizes: number[][] = [];
      const draws: number[][] = [];
      vi.stubGlobal(
        'OffscreenCanvas',
        class {
          constructor(
            public width: number,
            public height: number,
          ) {
            sizes.push([width, height]);
          }
          getContext() {
            return {
              drawImage: (_image: unknown, ...rest: number[]) => {
                draws.push(rest);
              },
            };
          }
          async convertToBlob() {
            return new Blob(['x'], { type: 'image/jpeg' });
          }
        },
      );
      // Three screens tall; the section starts on the second.
      let y = 0;
      chrome.scripting.executeScript.mockImplementation(
        async ({
          func,
          args,
        }: {
          func: { name: string };
          args?: unknown[];
        }) => {
          if (func.name === 'sectionBox') {
            return [
              {
                result: {
                  x: 100,
                  y: 900,
                  width: 500,
                  height: 1000,
                  matches: 2,
                },
              },
            ];
          }
          if (typeof args?.[0] === 'number') y = Math.min(args[0], 1600);
          return [
            {
              result: {
                y,
                viewportWidth: 1000,
                viewportHeight: 800,
                contentWidth: 1000,
                pageHeight: 2400,
              },
            },
          ];
        },
      );
      let n = 0;
      chrome.tabs.captureVisibleTab.mockImplementation(
        async () => `data:image/png;base64,${n++}`,
      );
      const taking = createCapture({ chrome }).capture(1, {
        selector: '.pricing',
      });
      await vi.runAllTimersAsync();
      await expect(taking).resolves.toMatchObject({
        method: 'stitched',
        matches: 2,
      });
      expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(2);
      expect(sizes[0]).toEqual([500, 1000]);
      // Its columns, drawn from the top of the picture, then the rest below.
      expect(draws[0]).toEqual([100, 0, 500, 800, 0, 0, 500, 800]);
      expect(draws[1]).toEqual([100, 0, 500, 800, 0, 700, 500, 800]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says when no element matches, without taking a screen', async () => {
    chrome.scripting.executeScript.mockImplementation(
      async ({ func }: { func: { name: string } }) => [
        {
          result:
            func.name === 'sectionBox'
              ? { error: 'no-section' }
              : { y: 0, viewportWidth: 1000, viewportHeight: 800 },
        },
      ],
    );
    await expect(
      createCapture({ chrome }).capture(1, { selector: '.missing' }),
    ).resolves.toEqual({ error: 'no-section' });
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  it('scrolls and stitches instead', async () => {
    vi.stubGlobal('fetch', async () => ({ blob: async () => new Blob() }));
    vi.stubGlobal('createImageBitmap', async () => ({
      width: 1000,
      height: 800,
      close: () => undefined,
    }));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return { drawImage: () => undefined };
        }
        async convertToBlob() {
          return new Blob(['x'], { type: 'image/jpeg' });
        }
      },
    );
    const shot = await createCapture({ chrome }).capture(1);
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledOnce();
    expect(shot).toMatchObject({
      method: 'stitched',
      reason: 'Another debugger',
    });
    expect((shot as { dataUrl: string }).dataUrl).toMatch(
      /^data:image\/jpeg;base64,/,
    );
  });

  it.each([
    [{ tabId: 1, attached: true }, 'devtools-open'],
    [{ tabId: 1, attached: true, extensionId: 'abc' }, 'other-extension'],
  ])('says who holds the tab when stitching fails too', async (held, code) => {
    targets = [held];
    chrome.tabs.captureVisibleTab.mockRejectedValue(new Error('no'));
    await expect(createCapture({ chrome }).capture(1)).resolves.toMatchObject({
      error: code,
    });
  });

  it('says Chrome does not allow it on pages it protects', async () => {
    chrome.scripting.executeScript.mockRejectedValue(
      new Error('Cannot access a chrome:// URL'),
    );
    await expect(createCapture({ chrome }).capture(1)).resolves.toMatchObject({
      error: 'not-allowed',
    });
  });
});

it('reports a tab that no longer exists', async () => {
  await expect(createCapture({ chrome }).capture(99)).resolves.toMatchObject({
    error: 'failed',
  });
});

it('fitScale leaves normal pages alone', () => {
  expect(fitScale(5000)).toBe(1);
  expect(fitScale(MAX_IMAGE_HEIGHT * 2)).toBe(0.5);
});

describe('scrolling through before the picture', () => {
  // A page three screens tall, run here instead of in a browser.
  function fakePage() {
    const scrolled: number[] = [];
    const exec = vi.fn(async (func: unknown, args: unknown[]) => {
      if (func === pageScrollState) {
        return { y: 250, height: 2400, step: 800 };
      }
      if (func === pageScrollTo) {
        scrolled.push(args[0] as number);
        return 2400;
      }
      throw new Error('unexpected page script');
    });
    return { exec, scrolled };
  }

  it('scrolls one screen at a time, then back to where it was', async () => {
    vi.useFakeTimers();
    const { exec, scrolled } = fakePage();
    const done = scrollThrough(exec);
    await vi.runAllTimersAsync();
    await expect(done).resolves.toBe(250);
    expect(scrolled).toEqual([0, 800, 1600, 250]);
  });

  it('waits between screens here, not with timers in the page', async () => {
    vi.useFakeTimers();
    const { exec, scrolled } = fakePage();
    void scrollThrough(exec, 0);
    await vi.advanceTimersByTimeAsync(0);
    expect(scrolled).toEqual([0]);
    await vi.advanceTimersByTimeAsync(SCROLL_PAUSE_MS);
    expect(scrolled).toEqual([0, 800]);
    await vi.runAllTimersAsync();
    expect(scrolled.at(-1)).toBe(0);
  });

  it('gives up quietly on a page it cannot read', async () => {
    const exec = vi.fn(async () => null);
    await expect(scrollThrough(exec, 0)).resolves.toBe(0);
  });
});
