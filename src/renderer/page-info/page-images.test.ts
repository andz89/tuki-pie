import { describe, expect, it } from 'vitest';
import { filterImages, imagesWord } from './page-images';

const URLS = [
  'https://a.com/img/Hero.JPG',
  'https://a.com/img/logo.svg',
  'https://cdn.b.com/hero-small.png',
];

describe('filterImages', () => {
  it('keeps every image for an empty filter', () => {
    expect(filterImages(URLS, '  ')).toEqual(URLS);
  });

  it('matches without case, every word required', () => {
    expect(filterImages(URLS, 'hero')).toEqual([URLS[0], URLS[2]]);
    expect(filterImages(URLS, 'HERO cdn')).toEqual([URLS[2]]);
  });

  it('finds nothing when a word is missing', () => {
    expect(filterImages(URLS, 'logo cdn')).toEqual([]);
  });
});

describe('imagesWord', () => {
  it('counts one and many', () => {
    expect(imagesWord(1)).toBe('1 image');
    expect(imagesWord(3)).toBe('3 images');
  });
});
