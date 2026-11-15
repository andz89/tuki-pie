import { describe, expect, it } from 'vitest';
import {
  pageScreenshotFileName,
  pixelArea,
  screenshotFileName,
} from './screenshot-geometry';

const IMAGE = { width: 3000, height: 2000 };

describe('pixelArea', () => {
  it('keeps the area as it is on an unscaled display', () => {
    expect(
      pixelArea({ x: 10, y: 20, width: 100, height: 50 }, 1, IMAGE),
    ).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('scales the area up on a scaled display', () => {
    expect(
      pixelArea({ x: 10, y: 20, width: 100, height: 50 }, 1.5, IMAGE),
    ).toEqual({ x: 15, y: 30, width: 150, height: 75 });
  });

  it('keeps the area inside the image', () => {
    expect(
      pixelArea({ x: -5, y: 1990, width: 100, height: 50 }, 1, IMAGE),
    ).toEqual({ x: 0, y: 1990, width: 95, height: 10 });
  });

  it('gives nothing for an empty area', () => {
    expect(pixelArea({ x: 5, y: 5, width: 0, height: 40 }, 1, IMAGE)).toBe(
      null,
    );
  });

  it('gives nothing for an area entirely outside the image', () => {
    expect(pixelArea({ x: 4000, y: 10, width: 50, height: 50 }, 1, IMAGE)).toBe(
      null,
    );
  });
});

describe('screenshotFileName', () => {
  it('names the file after the moment it was taken', () => {
    expect(screenshotFileName(new Date(2026, 10, 9, 8, 5, 3))).toBe(
      'Screenshot 2026-11-09 080503.png',
    );
  });
});

describe('pageScreenshotFileName', () => {
  const time = new Date(2026, 10, 9, 8, 5, 3);

  it('names the file after the page and the moment', () => {
    expect(pageScreenshotFileName('Home | Shop', time)).toBe(
      'Home Shop 2026-11-09 080503.jpg',
    );
  });

  it('adds the device it was taken as', () => {
    expect(pageScreenshotFileName('Home', time, 'iPhone 16')).toBe(
      'Home iPhone 16 2026-11-09 080503.jpg',
    );
  });

  it('adds the section it was taken of, cleaned like the title', () => {
    expect(pageScreenshotFileName('Home', time, '', '.pricing')).toBe(
      'Home .pricing 2026-11-09 080503.jpg',
    );
    expect(
      pageScreenshotFileName('Home', time, 'iPhone 16', 'main > #a:first'),
    ).toBe('Home iPhone 16 main #a first 2026-11-09 080503.jpg');
  });

  it('drops characters Windows refuses and trailing dots', () => {
    expect(pageScreenshotFileName('a/b:c*?"<>.. ', time)).toBe(
      'a b c 2026-11-09 080503.jpg',
    );
  });

  it('keeps long titles short', () => {
    const name = pageScreenshotFileName('x'.repeat(300), time);
    expect(name).toBe(`${'x'.repeat(60)} 2026-11-09 080503.jpg`);
  });

  it('falls back when the page has no title', () => {
    expect(pageScreenshotFileName('  ', time)).toBe(
      'Web page 2026-11-09 080503.jpg',
    );
  });
});
