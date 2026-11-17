import { describe, expect, it } from 'vitest';
import { DEFAULT_LINK_FILTER } from '../../shared/link-rules';
import type { InfoCardPage } from '../../shared/types';
import {
  MAX_HIGHLIGHT_WORDS,
  allowedCardLinks,
  highlightWords,
} from './card-links';

const page = {
  url: 'https://shop.de/',
  links: [
    { href: 'https://shop.de/shoes', hidden: false },
    { href: 'https://shop.de/reset?token=abc123def456ghi789', hidden: false },
  ],
  images: ['https://shop.de/hero.jpg'],
} as InfoCardPage;

const none = new Set<string>();

describe('highlight words', () => {
  it('splits on spaces, once each, at most ten', () => {
    expect(highlightWords('  price  fair price ')).toEqual(['price', 'fair']);
    expect(highlightWords('')).toEqual([]);
    expect(highlightWords('a b c d e f g h i j k l').length).toBe(
      MAX_HIGHLIGHT_WORDS,
    );
  });
});

describe('links the Links card may open', () => {
  it('opens only links of the page on the card', () => {
    expect(
      allowedCardLinks(
        ['https://shop.de/shoes', 'https://evil.example/'],
        none,
        page,
        DEFAULT_LINK_FILTER,
      ),
    ).toEqual(['https://shop.de/shoes']);
  });

  it('opens the images of the page on the card too', () => {
    expect(
      allowedCardLinks(
        ['https://shop.de/hero.jpg', 'https://shop.de/other.jpg'],
        none,
        page,
        DEFAULT_LINK_FILTER,
      ),
    ).toEqual(['https://shop.de/hero.jpg']);
  });

  it('opens nothing without a page', () => {
    expect(
      allowedCardLinks(
        ['https://shop.de/shoes'],
        none,
        null,
        DEFAULT_LINK_FILTER,
      ),
    ).toEqual([]);
  });

  it('opens a link with a token only once ticked, as on Web Page', () => {
    const token = 'https://shop.de/reset?token=abc123def456ghi789';
    expect(allowedCardLinks([token], none, page, DEFAULT_LINK_FILTER)).toEqual(
      [],
    );
    expect(
      allowedCardLinks([token], new Set([token]), page, DEFAULT_LINK_FILTER),
    ).toEqual([token]);
  });
});
