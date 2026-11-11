import { describe, expect, it } from 'vitest';
import { DESCRIPTION_MAX, DESCRIPTION_MIN } from '../../shared/page-audit';
import { isLengthOk, moreNote, shareImageSource } from './page-info-view';

describe('shareImageSource', () => {
  const PAGE = 'https://a.com/blog/post';

  it('keeps a full address', () => {
    expect(shareImageSource('https://cdn.a.com/x.jpg', PAGE)).toBe(
      'https://cdn.a.com/x.jpg',
    );
  });

  it('resolves an address relative to the page', () => {
    expect(shareImageSource('/img/x.jpg', PAGE)).toBe(
      'https://a.com/img/x.jpg',
    );
  });

  it.each([
    'file:///C:/Users/ACER/photo.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
  ])('refuses %s', (url) => {
    expect(shareImageSource(url, PAGE)).toBeNull();
  });

  it('refuses an address that cannot be read', () => {
    expect(shareImageSource('https://', PAGE)).toBeNull();
  });
});

describe('moreNote', () => {
  it('says how much of a long list is shown', () => {
    expect(moreNote({ total: 120, items: Array(50).fill(0) })).toBe(
      'Showing 50 of 120',
    );
  });

  it('says nothing about a complete list', () => {
    expect(moreNote({ total: 2, items: [1, 2] })).toBeNull();
  });
});

describe('isLengthOk', () => {
  it.each([
    [49, false],
    [50, true],
    [160, true],
    [161, false],
  ])('a description of %i is %s', (length, expected) => {
    expect(isLengthOk(length, DESCRIPTION_MIN, DESCRIPTION_MAX)).toBe(expected);
  });
});
