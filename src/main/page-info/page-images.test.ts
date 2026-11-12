import { describe, expect, it, vi } from 'vitest';
import { MAX_AT_ONCE, PageImages } from './page-images';
import type { CurrentPage } from './page-images';

const ANSWER = { dataUrl: 'data:image/webp;base64,AA', width: 10, height: 5 };

function setup(page: CurrentPage | null = pageWith(1)) {
  let current = page;
  const request = vi.fn(async () => ANSWER as unknown);
  const images = new PageImages({
    request,
    currentPage: () => current,
  });
  return {
    images,
    request,
    setPage: (next: CurrentPage | null) => (current = next),
  };
}

function pageWith(reportId: number): CurrentPage {
  return {
    reportId,
    url: 'https://shop.com/products',
    images: ['https://cdn.shop.com/a.png', 'https://cdn.shop.com/b.png'],
    featuredImages: ['/share.jpg'],
  };
}

describe('PageImages', () => {
  it('asks Chrome for an image on the page, small or full', async () => {
    const { images, request } = setup();
    await expect(
      images.get('https://cdn.shop.com/a.png', 'thumb'),
    ).resolves.toEqual(ANSWER);
    expect(request).toHaveBeenCalledWith(
      'image',
      { url: 'https://cdn.shop.com/a.png', size: 'thumb' },
      15000,
    );
    await images.get('https://cdn.shop.com/a.png', 'full');
    expect(request).toHaveBeenLastCalledWith(
      'image',
      { url: 'https://cdn.shop.com/a.png', size: 'full' },
      30000,
    );
  });

  it('finds a share image given as an address relative to the page', async () => {
    const { images, request } = setup();
    await images.get('https://shop.com/share.jpg', 'thumb');
    expect(request).toHaveBeenCalledOnce();
  });

  it('never asks Chrome for an address that is not on the page', async () => {
    const { images, request } = setup();
    await expect(
      images.get('http://192.168.1.1/admin', 'thumb'),
    ).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('asks for nothing before a page is checked', async () => {
    const { images, request } = setup(null);
    await expect(
      images.get('https://cdn.shop.com/a.png', 'thumb'),
    ).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it('fetches one picture once per page, even when asked twice at once', async () => {
    const { images, request } = setup();
    await Promise.all([
      images.get('https://cdn.shop.com/a.png', 'thumb'),
      images.get('https://cdn.shop.com/a.png', 'thumb'),
    ]);
    await images.get('https://cdn.shop.com/a.png', 'thumb');
    expect(request).toHaveBeenCalledOnce();
  });

  it('asks again once the page has changed', async () => {
    const { images, request, setPage } = setup();
    await images.get('https://cdn.shop.com/a.png', 'thumb');
    setPage(pageWith(2));
    await images.get('https://cdn.shop.com/a.png', 'thumb');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it(`sends at most ${MAX_AT_ONCE} requests to Chrome at once`, async () => {
    const page = pageWith(1);
    page.images = Array.from(
      { length: 10 },
      (_, n) => `https://cdn.shop.com/${n}.png`,
    );
    const { images, request } = setup(page);
    let running = 0;
    let most = 0;
    request.mockImplementation(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return ANSWER;
    });
    await Promise.all(page.images.map((url) => images.get(url, 'thumb')));
    expect(request).toHaveBeenCalledTimes(10);
    expect(most).toBe(MAX_AT_ONCE);
  });

  it.each([
    [{ error: 'not-image' }],
    [{ dataUrl: 'https://evil.example/x.png', width: 1, height: 1 }],
    [{ dataUrl: 'data:text/html;base64,AA', width: 1, height: 1 }],
    [null],
  ])('treats an answer that is not a picture as broken: %j', async (answer) => {
    const { images, request } = setup();
    request.mockResolvedValueOnce(answer);
    await expect(
      images.get('https://cdn.shop.com/a.png', 'thumb'),
    ).resolves.toBeNull();
  });

  it('treats Chrome not answering as broken', async () => {
    const { images, request } = setup();
    request.mockRejectedValueOnce(new Error('no-answer'));
    await expect(
      images.get('https://cdn.shop.com/a.png', 'thumb'),
    ).resolves.toBeNull();
  });
});
