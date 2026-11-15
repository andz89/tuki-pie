// A picture of the whole page, or of one element on it, as Chrome draws it,
// ported from tuki.
// First through Chrome's debugger, which renders the page in one pass, so
// sticky headers appear once and nothing is stitched. When Chrome won't let
// the debugger attach (DevTools open, another extension on the tab), the page
// is scrolled and its screens are stitched together instead.
// Failures come back as { error } rather than thrown: the request handler
// would turn a thrown error into a bare "failed".

import { deviceEmulation } from './devices.js';

export const JPEG_QUALITY = 80;
// Taller pictures are scaled down. A JPEG can't pass 65,535 pixels, and
// Chrome may leave very tall captures blank.
export const MAX_IMAGE_HEIGHT = 30000;
// The tallest view the debugger is asked to draw, in CSS pixels. An endless
// page would otherwise ask Chrome for a view hundreds of thousands tall.
export const MAX_CAPTURE_HEIGHT = 60000;
export const COMMAND_MS = 30000;
// Chrome allows about two captureVisibleTab calls per second.
export const CAPTURE_GAP_MS = 600;
export const MAX_FRAMES = 80;
// Time for the page to lay itself out at its new size.
export const RESIZE_SETTLE_MS = 400;
// Time for CSS and resize handlers to switch to a device's layout.
export const DEVICE_SETTLE_MS = 600;
// The longest wait for a page to load as a device, and back again.
export const LOAD_WAIT_MS = 20000;

// Tries again this often when a screen comes back unchanged after scrolling.
export const STALE_RETRIES = 3;
export const MAX_REASON_LENGTH = 300;

export const CAPTURE_ERRORS = [
  'devtools-open',
  'other-extension',
  'not-allowed',
  'not-drawn',
  'no-device',
  'bad-selector',
  'no-section',
  'empty-section',
  'timeout',
  'failed',
];

class TimeoutError extends Error {}
class NotDrawnError extends Error {}

// Scrolling through before the picture: screens at most, the pause on each
// so lazy images start, and the settle after going back.
export const SCROLL_STEPS = 40;
export const SCROLL_PAUSE_MS = 120;
export const SCROLL_SETTLE_MS = 400;

// In the page: where it is, how tall it is, and one screen's step.
export function pageScrollState() {
  return {
    y: scrollY,
    height: document.documentElement.scrollHeight,
    step: Math.max(innerHeight, 400),
  };
}

// In the page: scrolls to `y` and says how tall the page is now.
export function pageScrollTo(y) {
  scrollTo(0, y);
  return document.documentElement.scrollHeight;
}

// Scrolls through once so lazy images and scroll-triggered content render,
// then goes to `backTo`, or where it was. Returns where it was. `exec(func,
// args)` runs one of the page functions above in the tab.
// The waits run here in the extension, not in the page: Chrome slows a
// page's own timers to about once a second while its window is behind
// others, which made this take some 40 seconds instead of 5.
export async function scrollThrough(exec, backTo) {
  const start = await exec(pageScrollState, []);
  if (!start || !Number.isFinite(start.height) || !(start.step > 0)) {
    return backTo ?? 0;
  }
  let height = start.height;
  for (let y = 0, i = 0; y < height && i < SCROLL_STEPS; y += start.step, i++) {
    const now = await exec(pageScrollTo, [y]);
    height = Number.isFinite(now) ? now : height;
    await new Promise((resolve) => setTimeout(resolve, SCROLL_PAUSE_MS));
  }
  await exec(pageScrollTo, [backTo ?? start.y]);
  await new Promise((resolve) => setTimeout(resolve, SCROLL_SETTLE_MS));
  return start.y;
}

// In the page: scrolls to y, waits two frames, reports where it landed.
function scrollAndMeasure(y) {
  document.documentElement.style.setProperty(
    'scroll-behavior',
    'auto',
    'important',
  );
  scrollTo(0, y);
  return new Promise((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        resolve({
          y: scrollY,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          contentWidth: document.documentElement.clientWidth,
          pageHeight: Math.max(
            document.documentElement.scrollHeight,
            document.body?.scrollHeight ?? 0,
          ),
        }),
      ),
    ),
  );
}

// In the page: hides fixed and sticky elements, so headers and chat buttons
// appear once (in the first screen) instead of on every screen.
function hideFloating() {
  for (const element of document.querySelectorAll('body *')) {
    const { position } = getComputedStyle(element);
    if (position === 'fixed' || position === 'sticky') {
      element.setAttribute('data-pie-hidden', element.style.visibility);
      element.style.setProperty('visibility', 'hidden', 'important');
    }
  }
}

function restorePage(startY) {
  for (const element of document.querySelectorAll('[data-pie-hidden]')) {
    element.style.visibility = element.getAttribute('data-pie-hidden');
    element.removeAttribute('data-pie-hidden');
  }
  document.documentElement.style.removeProperty('scroll-behavior');
  scrollTo(0, startY);
}

// The longest section selector taken.
export const MAX_SELECTOR_LENGTH = 500;

// In the page: the first element matching `selector`, as a box in page
// coordinates cut to the page, and how many elements match. Or { error }.
// The selector is used exactly as given: Pie Launcher already built it from
// the class names, id or CSS the user typed.
// Self-contained: Chrome runs it in the page from its source.
export function sectionBox(selector) {
  let found;
  try {
    found = document.querySelectorAll(selector);
  } catch {
    return { error: 'bad-selector' };
  }
  if (found.length === 0) {
    return { error: 'no-section' };
  }
  const rect = found[0].getBoundingClientRect();
  const page = document.documentElement;
  const left = Math.max(0, rect.left + scrollX);
  const top = Math.max(0, rect.top + scrollY);
  const right = Math.min(page.scrollWidth, rect.right + scrollX);
  const bottom = Math.min(
    Math.max(page.scrollHeight, document.body?.scrollHeight ?? 0),
    rect.bottom + scrollY,
  );
  if (right - left < 1 || bottom - top < 1) {
    return { error: 'empty-section' };
  }
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    matches: found.length,
  };
}

// The part of a box inside a picture `width` x `height`, in whole pixels, or
// null when none of it is.
export function clipBox(box, width, height) {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const right = Math.min(width, Math.ceil(box.x + box.width));
  const bottom = Math.min(height, Math.ceil(box.y + box.height));
  if (right <= x || bottom <= y) {
    return null;
  }
  return { x, y, width: right - x, height: bottom - y };
}

// Scale for a picture `height` image pixels tall, so it fits the cap.
export const fitScale = (height) =>
  height > MAX_IMAGE_HEIGHT ? MAX_IMAGE_HEIGHT / height : 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), COMMAND_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Without FileReader, which not every service worker has.
export async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(text)}`;
}

export function createCapture({ chrome }) {
  async function run(tabId, func, args = []) {
    const [first] = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
    });
    return first?.result;
  }

  // Hidden tabs don't paint, so the tab comes to the front for the capture
  // and the tab you had open comes back afterwards.
  async function inFront(tab, fn, { focusWindow = false } = {}) {
    const [previous] = tab.active
      ? []
      : await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (previous) {
      await chrome.tabs.update(tab.id, { active: true });
    }
    // A window behind others, or minimized, doesn't draw its page, so the
    // capture would wait on it. It comes forward for the capture.
    let wasMinimized = false;
    if (focusWindow) {
      const window = await chrome.windows.get(tab.windowId).catch(() => null);
      wasMinimized = window?.state === 'minimized';
      await chrome.windows
        .update(
          tab.windowId,
          wasMinimized ? { state: 'normal', focused: true } : { focused: true },
        )
        .catch(() => undefined);
    }
    try {
      return await fn();
    } finally {
      if (previous) {
        await chrome.tabs
          .update(previous.id, { active: true })
          .catch(() => undefined);
      }
      if (wasMinimized) {
        await chrome.windows
          .update(tab.windowId, { state: 'minimized' })
          .catch(() => undefined);
      }
    }
  }

  async function attachedInfo(tabId) {
    const targets = await Promise.resolve()
      .then(() => chrome.debugger.getTargets())
      .catch(() => []);
    return targets.find((each) => each.tabId === tabId && each.attached);
  }

  const isOurs = (info) =>
    Boolean(info?.extensionId) && info.extensionId === chrome.runtime?.id;

  // Who holds the debugger on this tab, when it isn't us.
  async function holder(tabId) {
    const info = await attachedInfo(tabId);
    if (!info || isOurs(info)) {
      return null;
    }
    return info.extensionId ? 'other-extension' : 'devtools-open';
  }

  // As in tuki: a capture of ours that never detached (the service worker
  // stopped mid-capture) still holds the tab, so take it back and retry.
  async function attach(target) {
    try {
      await chrome.debugger.attach(target, '1.3');
    } catch (error) {
      if (!isOurs(await attachedInfo(target.tabId))) {
        throw error;
      }
      await chrome.debugger.detach(target).catch(() => undefined);
      await chrome.debugger.attach(target, '1.3');
    }
  }

  // Resolves on the page's load event, or after LOAD_WAIT_MS so a page that
  // never finishes loading is still captured as far as it got.
  function debuggerPageLoad(tabId) {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        chrome.debugger.onEvent.removeListener(onEvent);
        resolve();
      };
      const onEvent = (source, method) => {
        if (source.tabId === tabId && method === 'Page.loadEventFired') {
          done();
        }
      };
      const timer = setTimeout(done, LOAD_WAIT_MS);
      chrome.debugger.onEvent.addListener(onEvent);
    });
  }

  // Reloads the tab and waits until it has loaded, or LOAD_WAIT_MS.
  function reloadTab(tabId) {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      };
      const onUpdated = (id, change) => {
        if (id === tabId && change.status === 'complete') {
          done();
        }
      };
      const timer = setTimeout(done, LOAD_WAIT_MS);
      chrome.tabs.onUpdated.addListener(onUpdated);
      Promise.resolve()
        .then(() => chrome.tabs.reload(tabId))
        .catch(done);
    });
  }

  // As Chrome's device toolbar does it: the size, touch and the device's own
  // user agent. Sites that pick their mobile version on the server only
  // switch when the page loads again, so `reload` loads it as the device.
  async function emulate(send, tabId, device, reload) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: device.width,
      height: device.height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    });
    await send('Emulation.setUserAgentOverride', {
      userAgent: device.userAgent,
    });
    if (!reload) {
      await sleep(DEVICE_SETTLE_MS);
      return;
    }
    await send('Page.enable');
    const loaded = debuggerPageLoad(tabId);
    await send('Page.reload');
    await loaded;
  }

  // `selector`: the section to take, or empty for the whole page.
  async function withDebugger(
    tabId,
    { device = null, reload = false, selector = '' } = {},
  ) {
    const target = { tabId };
    await attach(target);
    const send = (method, params) =>
      withTimeout(chrome.debugger.sendCommand(target, method, params));
    const evaluate = async (expression) =>
      (
        await send('Runtime.evaluate', {
          expression,
          returnByValue: true,
          awaitPromise: true,
        })
      )?.result?.value;
    const contentSize = async () => {
      const metrics = await send('Page.getLayoutMetrics');
      return {
        width: Math.ceil(metrics.cssContentSize.width),
        height: Math.ceil(metrics.cssContentSize.height),
      };
    };
    // Chrome's own full-page mode (captureBeyondViewport) can repeat the
    // visible part down the picture. Making the viewport as tall as the page
    // draws all of it for real, as Puppeteer long did.
    let startY = 0;
    let resized = false;
    let reloaded = false;
    let timedOut = false;
    try {
      startY = Number(await evaluate('scrollY')) || 0;
      if (device) {
        resized = true;
        reloaded = reload;
        await emulate(send, tabId, device, reload);
        // Lazy images load for the device's size.
        await scrollThrough(
          (func, args) => evaluate(`(${func})(...${JSON.stringify(args)})`),
          0,
        );
      }
      const before = await contentSize();
      // A device is captured at one image pixel per CSS pixel. A desktop page
      // keeps the screen's own scaling (deviceScaleFactor 0).
      const ratio = device
        ? 1
        : Number(await evaluate('devicePixelRatio')) || 1;
      const view = device
        ? { width: device.width, deviceScaleFactor: 1, mobile: true }
        : { width: before.width, deviceScaleFactor: 0, mobile: false };
      const resize = (height) =>
        send('Emulation.setDeviceMetricsOverride', {
          ...view,
          height: Math.min(height, MAX_CAPTURE_HEIGHT),
        });
      await resize(before.height);
      resized = true;
      await evaluate('scrollTo(0, 0)');
      await sleep(RESIZE_SETTLE_MS);
      // Sections sized to the screen grow with it, so measure again.
      const after = await contentSize();
      const { width } = view;
      const height = Math.min(
        Math.max(before.height, after.height),
        MAX_CAPTURE_HEIGHT,
      );
      if (height > Math.min(before.height, MAX_CAPTURE_HEIGHT)) {
        await resize(height);
        await sleep(RESIZE_SETTLE_MS);
      }
      // The page is now as tall as the view and scrolled to the top, so the
      // section is measured where it will be drawn.
      let area = { x: 0, y: 0, width, height };
      let matches = null;
      if (selector) {
        const box = await evaluate(
          `(${sectionBox})(${JSON.stringify(selector)})`,
        );
        if (!box || box.error) {
          return { error: box?.error ?? 'failed' };
        }
        area = clipBox(box, width, height);
        if (area === null) {
          return { error: 'empty-section' };
        }
        matches = box.matches;
      }
      const scale = fitScale(area.height * ratio);
      const { data } = await send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: JPEG_QUALITY,
        clip: { ...area, scale },
      });
      return {
        dataUrl: `data:image/jpeg;base64,${data}`,
        method: 'debugger',
        ...(matches === null ? {} : { matches }),
      };
    } catch (error) {
      timedOut = error instanceof TimeoutError;
      throw error;
    } finally {
      // A hung page would make each cleanup command wait COMMAND_MS as well.
      // Detaching alone ends the size, touch and user agent changes.
      if (resized && !timedOut) {
        await send('Emulation.clearDeviceMetricsOverride').catch(
          () => undefined,
        );
        if (!reloaded) {
          await evaluate(`scrollTo(0, ${startY})`).catch(() => undefined);
        }
      }
      // Detaching ends the device's touch and user agent too.
      await chrome.debugger.detach(target).catch(() => undefined);
      // The page loaded as the device, so it loads once more as itself.
      if (reloaded) {
        await reloadTab(tabId);
      }
    }
  }

  // With a `selector`, only the screens covering that element are taken,
  // and only its columns drawn.
  async function stitch(tabId, windowId, selector = '') {
    const startY = await scrollThrough(
      (func, args) => run(tabId, func, args),
      0,
    );
    // Each screen is drawn the moment it is taken and then freed, so only
    // one is ever held: 80 full screens at once could take gigabytes.
    let canvas = null;
    let context = null;
    let ratio = 1;
    let shrink = 1;
    let cropX = 0;
    let cropWidth = 0;
    // The part of the page taken, in CSS pixels from its top.
    let top = 0;
    let bottom = 0;
    let section = null;
    // How far down the picture the screens reached.
    let drawnTo = 0;
    try {
      if (selector) {
        section = await run(tabId, sectionBox, [selector]);
        if (!section || section.error) {
          return { error: section?.error ?? 'failed' };
        }
        // A fixed header would cover the section's first screen.
        await run(tabId, hideFloating);
        top = Math.floor(section.y);
      }
      let target = top;
      let lastCapture = 0;
      let previousShot = null;
      let previousY = null;
      for (let i = 0; i < MAX_FRAMES; i++) {
        const measure = await run(tabId, scrollAndMeasure, [target]);
        // The page won't scroll any further, so there is nothing new below.
        if (i > 0 && measure.y <= previousY) {
          break;
        }
        let shot = null;
        // The page moved but the picture didn't: Chrome isn't drawing the
        // window (hidden behind others), so it hands back its last frame.
        for (let tries = 0; tries <= STALE_RETRIES; tries++) {
          await sleep(Math.max(0, lastCapture + CAPTURE_GAP_MS - Date.now()));
          shot = await chrome.tabs.captureVisibleTab(windowId, {
            format: 'png',
          });
          lastCapture = Date.now();
          if (i === 0 || shot !== previousShot || measure.y === previousY) {
            break;
          }
          if (tries === STALE_RETRIES) {
            throw new NotDrawnError();
          }
        }
        previousShot = shot;
        previousY = measure.y;
        const bitmap = await createImageBitmap(
          await (await fetch(shot)).blob(),
        );
        try {
          if (canvas === null) {
            // Image pixels per CSS pixel (screen scaling, page zoom).
            ratio = bitmap.width / measure.viewportWidth;
            const area = section
              ? clipBox(section, measure.contentWidth, measure.pageHeight)
              : null;
            if (section && area === null) {
              return { error: 'empty-section' };
            }
            cropX = area ? Math.round(area.x * ratio) : 0;
            cropWidth = Math.round(
              (area ? area.width : measure.contentWidth) * ratio,
            );
            bottom = Math.min(
              area ? area.y + area.height : measure.pageHeight,
              top + MAX_FRAMES * measure.viewportHeight,
            );
            const fullHeight = Math.round((bottom - top) * ratio);
            shrink = fitScale(fullHeight);
            canvas = new OffscreenCanvas(
              Math.round(cropWidth * shrink),
              Math.round(fullHeight * shrink),
            );
            context = canvas.getContext('2d');
          }
          // Below zero when the page can't scroll the section to the top.
          const drawAt = Math.round((measure.y - top) * ratio * shrink);
          const height = Math.round(bitmap.height * shrink);
          context.drawImage(
            bitmap,
            cropX,
            0,
            cropWidth,
            bitmap.height,
            0,
            drawAt,
            canvas.width,
            height,
          );
          drawnTo = Math.max(drawnTo, Math.min(canvas.height, drawAt + height));
        } finally {
          bitmap.close();
        }
        if (i === 0 && !section) {
          await run(tabId, hideFloating);
        }
        if (
          measure.y + measure.viewportHeight >=
          Math.min(measure.pageHeight, bottom)
        ) {
          break;
        }
        target = measure.y + measure.viewportHeight;
      }
    } finally {
      await run(tabId, restorePage, [startY]).catch(() => undefined);
    }

    // A page that stopped scrolling early would leave a blank bottom.
    let picture = canvas;
    if (drawnTo < canvas.height) {
      picture = new OffscreenCanvas(canvas.width, drawnTo);
      picture.getContext('2d').drawImage(canvas, 0, 0);
    }
    const blob = await picture.convertToBlob({
      type: 'image/jpeg',
      quality: JPEG_QUALITY / 100,
    });
    return {
      dataUrl: await blobToDataUrl(blob),
      method: 'stitched',
      ...(section ? { matches: section.matches } : {}),
    };
  }

  // Chrome's own words, so the Screenshot tab can say why it stitched.
  const chromeSaid = (error) =>
    String(error?.message ?? error ?? '').slice(0, MAX_REASON_LENGTH) || null;

  // `device`: a name from devices.js, or empty for the tab as it is.
  // `selector`: a CSS selector for the section to take, or empty for the
  // whole page.
  async function capture(
    tabId,
    { device = '', reload = false, selector = '' } = {},
  ) {
    const section =
      typeof selector === 'string'
        ? selector.trim().slice(0, MAX_SELECTOR_LENGTH)
        : '';
    return captureOnce(tabId, device, reload === true, section).catch(() => ({
      error: 'failed',
    }));
  }

  async function captureOnce(tabId, deviceName, reload, selector) {
    const device = deviceName ? deviceEmulation(deviceName) : null;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || (deviceName && !device)) {
      return { error: 'failed' };
    }
    let reason = null;
    let debuggerSaid = null;
    try {
      return await inFront(
        tab,
        async () => {
          if (!device) {
            await scrollThrough((func, args) => run(tabId, func, args));
          }
          return withDebugger(tabId, { device, reload, selector });
        },
        { focusWindow: true },
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        return { error: 'timeout' };
      }
      reason = await holder(tabId);
      debuggerSaid = chromeSaid(error);
    }
    // Only the debugger can show a page as a device. Stitching would give
    // the desktop page under the device's name.
    if (device) {
      return { error: reason ?? 'no-device' };
    }
    try {
      const shot = await inFront(
        tab,
        () => stitch(tabId, tab.windowId, selector),
        { focusWindow: true },
      );
      return shot.error ? shot : { ...shot, reason: debuggerSaid };
    } catch (error) {
      if (error instanceof NotDrawnError) {
        return { error: 'not-drawn' };
      }
      return { error: reason ?? 'not-allowed' };
    }
  }

  return { capture };
}
