import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_IMAGE_BYTES,
  MAX_SVG_BYTES,
  THUMB_SIZE,
  createImageFetcher,
} from './image.js';

const PNG = new Uint8Array([137, 80, 78, 71]);

let drawn: { width: number; height: number }[];
let closed: number;

function respond(
  body: BodyInit | null,
  type: string | null,
  init: { status?: number; length?: number } = {},
) {
  const headers = new Headers();
  if (type) headers.set('content-type', type);
  if (init.length !== undefined) {
    headers.set('content-length', String(init.length));
  }
  return new Response(body, { status: init.status ?? 200, headers });
}

beforeEach(() => {
  drawn = [];
  closed = 0;
  vi.stubGlobal('createImageBitmap', async () => ({
    width: 1600,
    height: 800,
    close: () => {
      closed += 1;
    },
  }));
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number,
      ) {
        drawn.push({ width, height });
      }
      getContext() {
        return { drawImage: () => undefined };
      }
      async convertToBlob({ type }: { type: string }) {
        return new Blob(['small'], { type });
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const fetcherWith = (response: Response | Error) => {
  const fetch = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { image: createImageFetcher({ fetch }), fetch };
};

describe('the image action', () => {
  it('refuses anything but a web address', async () => {
    const { image, fetch } = fetcherWith(respond(PNG, 'image/png'));
    await expect(
      image({ url: 'file:///C:/a.png', size: 'thumb' }),
    ).resolves.toEqual({ error: 'not-web' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks with your Chrome session', async () => {
    const { image, fetch } = fetcherWith(respond(PNG, 'image/png'));
    await image({ url: 'https://a.com/x.png', size: 'full' });
    expect(fetch).toHaveBeenCalledWith(
      'https://a.com/x.png',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('fetches local addresses too', async () => {
    const { image } = fetcherWith(respond(PNG, 'image/png'));
    await expect(
      image({ url: 'http://localhost:3000/logo.png', size: 'full' }),
    ).resolves.toMatchObject({ dataUrl: expect.any(String) });
  });

  it('refuses an image said to be too large, before reading it', async () => {
    const { image } = fetcherWith(
      respond(PNG, 'image/png', { length: MAX_IMAGE_BYTES + 1 }),
    );
    await expect(
      image({ url: 'https://a.com/x.png', size: 'full' }),
    ).resolves.toEqual({ error: 'too-large' });
  });

  it('stops reading an image that turns out too large', async () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 10);
    const { image } = fetcherWith(respond(big, 'image/png'));
    await expect(
      image({ url: 'https://a.com/x.png', size: 'full' }),
    ).resolves.toEqual({ error: 'too-large' });
  });

  it('refuses what is not an image', async () => {
    const { image } = fetcherWith(respond('<html>', 'text/html'));
    await expect(
      image({ url: 'https://a.com/x.png', size: 'thumb' }),
    ).resolves.toEqual({ error: 'not-image' });
  });

  it('reports a server error as failed', async () => {
    const { image } = fetcherWith(respond(null, 'image/png', { status: 404 }));
    await expect(
      image({ url: 'https://a.com/x.png', size: 'thumb' }),
    ).resolves.toEqual({ error: 'failed' });
  });

  it('reports a fetch that throws as failed', async () => {
    const { image } = fetcherWith(new Error('offline'));
    await expect(
      image({ url: 'https://a.com/x.png', size: 'thumb' }),
    ).resolves.toEqual({ error: 'failed' });
  });

  it('makes a small WebP for a thumbnail, keeping the original size', async () => {
    const { image } = fetcherWith(respond(PNG, 'image/png'));
    const answer = await image({ url: 'https://a.com/x.png', size: 'thumb' });
    expect(answer).toMatchObject({ width: 1600, height: 800 });
    expect((answer as { dataUrl: string }).dataUrl).toMatch(
      /^data:image\/webp;base64,/,
    );
    expect(drawn).toEqual([{ width: THUMB_SIZE, height: THUMB_SIZE / 2 }]);
    expect(closed).toBe(1);
  });

  it('sends an SVG as it is, which an <img> shows without running it', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const { image } = fetcherWith(respond(svg, 'image/svg+xml'));
    const answer = await image({ url: 'https://a.com/x.svg', size: 'thumb' });
    expect((answer as { dataUrl: string }).dataUrl).toMatch(
      /^data:image\/svg\+xml;base64,/,
    );
    expect(drawn).toEqual([]);
  });

  it('refuses an SVG over its own limit', async () => {
    const svg = 'x'.repeat(MAX_SVG_BYTES + 1);
    const { image } = fetcherWith(respond(svg, 'image/svg+xml'));
    await expect(
      image({ url: 'https://a.com/x.svg', size: 'thumb' }),
    ).resolves.toEqual({ error: 'too-large' });
  });

  it('sends a full image as it came, so a GIF still moves', async () => {
    const { image } = fetcherWith(respond(PNG, 'image/gif'));
    const answer = await image({ url: 'https://a.com/x.gif', size: 'full' });
    expect(answer).toEqual({
      dataUrl: `data:image/gif;base64,${Buffer.from(PNG).toString('base64')}`,
      width: null,
      height: null,
    });
    expect(drawn).toEqual([]);
  });

  it('reports an image Chrome cannot decode as failed', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new Error('bad data');
    });
    const { image } = fetcherWith(respond(PNG, 'image/png'));
    await expect(
      image({ url: 'https://a.com/x.png', size: 'thumb' }),
    ).resolves.toEqual({ error: 'failed' });
  });
});
