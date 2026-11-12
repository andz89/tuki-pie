// Gets a page image in Chrome, with your Chrome session, for Page Info. The
// app never loads page images itself: image servers don't see it, and a page
// can't use it to reach your local network. Failures come back as { error },
// as in capture.js.

import { blobToDataUrl } from './capture.js';
import { isWebAddress } from './protocol.js';

// Read no further than this; Page Info only shows the picture.
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
// An SVG is sent as it is, so it keeps a lower limit of its own.
export const MAX_SVG_BYTES = 2 * 1024 * 1024;
// A thumbnail's longest side, in pixels: sharp in a list row on a 2x screen.
export const THUMB_SIZE = 320;
const THUMB_QUALITY = 0.8;

const SVG = 'image/svg+xml';

class TooLargeError extends Error {}

// The body, up to `limit` bytes, without holding more than that in memory.
async function readUpTo(response, limit) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    throw new TooLargeError();
  }
  if (!response.body) {
    return new Uint8Array(await response.arrayBuffer());
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.length;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new TooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}

async function thumbnail(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, THUMB_SIZE / Math.max(width, height, 1));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );
    canvas
      .getContext('2d')
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const small = await canvas.convertToBlob({
      type: 'image/webp',
      quality: THUMB_QUALITY,
    });
    return { dataUrl: await blobToDataUrl(small), width, height };
  } finally {
    bitmap.close();
  }
}

export function createImageFetcher({
  fetch: get = (...args) => fetch(...args),
} = {}) {
  // `size`: 'thumb' for a small picture, 'full' for the image as it came.
  return async function image(args) {
    const url = args?.url;
    const size = args?.size === 'full' ? 'full' : 'thumb';
    if (!isWebAddress(url)) {
      return { error: 'not-web' };
    }
    try {
      const response = await get(url, {
        credentials: 'include',
        redirect: 'follow',
        cache: 'force-cache',
      });
      if (!response.ok) {
        return { error: 'failed' };
      }
      const type = (response.headers.get('content-type') ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!type.startsWith('image/')) {
        return { error: 'not-image' };
      }
      const limit = type === SVG ? MAX_SVG_BYTES : MAX_IMAGE_BYTES;
      const blob = new Blob([await readUpTo(response, limit)], { type });
      // A service worker can't decode an SVG, and an <img> runs none of it.
      if (size === 'full' || type === SVG) {
        return {
          dataUrl: await blobToDataUrl(blob),
          width: null,
          height: null,
        };
      }
      return await thumbnail(blob);
    } catch (error) {
      return { error: error instanceof TooLargeError ? 'too-large' : 'failed' };
    }
  };
}
