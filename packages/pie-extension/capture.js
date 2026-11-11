// A picture of the whole page, as Chrome draws it, ported from tuki.
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
  'timeout',
  'failed',
];

class TimeoutError extends Error {}
class NotDrawnError extends Error {}

// In the page: scrolls through once so lazy images and scroll-triggered
// content render, then goes to `backTo`, or where it was. Returns where it was.
export async function scrollThrough(backTo) {
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const startY = scrollY;
  const step = Math.max(innerHeight, 400);
  for (
    let y = 0, i = 0;
    y < document.documentElement.scrollHeight && i < 40;
    y += step, i++
  ) {
    scrollTo(0, y);
    await pause(120);
  }
  scrollTo(0, backTo ?? startY);
  await pause(400);
  return startY;
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
    if (focusWindow) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    try {
      return await fn();
    } finally {
      if (previous) {
        await chrome.tabs
          .update(previous.id, { active: true })
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

  async function withDebugger(tabId, { device = null, reload = false } = {}) {
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
    try {
      startY = Number(await evaluate('scrollY')) || 0;
      if (device) {
        resized = true;
        reloaded = reload;
        await emulate(send, tabId, device, reload);
        // Lazy images load for the device's size.
        await evaluate(`(${scrollThrough})(0)`);
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
        send('Emulation.setDeviceMetricsOverride', { ...view, height });
      await resize(before.height);
      resized = true;
      await evaluate('scrollTo(0, 0)');
      await sleep(RESIZE_SETTLE_MS);
      // Sections sized to the screen grow with it, so measure again.
      const after = await contentSize();
      const { width } = view;
      const height = Math.max(before.height, after.height);
      if (height > before.height) {
        await resize(height);
        await sleep(RESIZE_SETTLE_MS);
      }
      const scale = fitScale(height * ratio);
      const { data } = await send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: JPEG_QUALITY,
        clip: { x: 0, y: 0, width, height, scale },
      });
      return { dataUrl: `data:image/jpeg;base64,${data}`, method: 'debugger' };
    } finally {
      if (resized) {
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

  async function stitch(tabId, windowId) {
    const startY = (await run(tabId, scrollThrough, [0])) ?? 0;
    const frames = [];
    let measure;
    try {
      let target = 0;
      let lastCapture = 0;
      let previousShot = null;
      let previousY = null;
      for (let i = 0; i < MAX_FRAMES; i++) {
        measure = await run(tabId, scrollAndMeasure, [target]);
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
        frames.push({ y: measure.y, bitmap });
        if (i === 0) {
          await run(tabId, hideFloating);
        }
        if (measure.y + measure.viewportHeight >= measure.pageHeight) {
          break;
        }
        target = measure.y + measure.viewportHeight;
      }
    } finally {
      await run(tabId, restorePage, [startY]).catch(() => undefined);
    }

    // Image pixels per CSS pixel (screen scaling, page zoom).
    const ratio = frames[0].bitmap.width / measure.viewportWidth;
    const cropWidth = Math.round(measure.contentWidth * ratio);
    const fullHeight = Math.round(measure.pageHeight * ratio);
    const shrink = fitScale(fullHeight);
    const canvas = new OffscreenCanvas(
      Math.round(cropWidth * shrink),
      Math.round(fullHeight * shrink),
    );
    const context = canvas.getContext('2d');
    for (const { y, bitmap } of frames) {
      context.drawImage(
        bitmap,
        0,
        0,
        cropWidth,
        bitmap.height,
        0,
        Math.round(y * ratio * shrink),
        canvas.width,
        Math.round(bitmap.height * shrink),
      );
      bitmap.close();
    }
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: JPEG_QUALITY / 100,
    });
    return { dataUrl: await blobToDataUrl(blob), method: 'stitched' };
  }

  // Chrome's own words, so the Screenshot tab can say why it stitched.
  const chromeSaid = (error) =>
    String(error?.message ?? error ?? '').slice(0, MAX_REASON_LENGTH) || null;

  // `device`: a name from devices.js, or empty for the tab as it is.
  async function capture(tabId, { device = '', reload = false } = {}) {
    return captureOnce(tabId, device, reload === true).catch(() => ({
      error: 'failed',
    }));
  }

  async function captureOnce(tabId, deviceName, reload) {
    const device = deviceName ? deviceEmulation(deviceName) : null;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || (deviceName && !device)) {
      return { error: 'failed' };
    }
    let reason = null;
    let debuggerSaid = null;
    try {
      return await inFront(tab, async () => {
        if (!device) {
          await run(tabId, scrollThrough, []);
        }
        return withDebugger(tabId, { device, reload });
      });
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
      const shot = await inFront(tab, () => stitch(tabId, tab.windowId), {
        focusWindow: true,
      });
      return { ...shot, reason: debuggerSaid };
    } catch (error) {
      if (error instanceof NotDrawnError) {
        return { error: 'not-drawn' };
      }
      return { error: reason ?? 'not-allowed' };
    }
  }

  return { capture };
}
