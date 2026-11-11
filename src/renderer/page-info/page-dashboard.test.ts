import { describe, expect, it } from 'vitest';
import {
  canonicalState,
  headingCounts,
  hostOf,
  lengthState,
  linkBreakdown,
  outline,
} from './page-dashboard';

const PAGE = 'https://www.shop.com/products';

describe('linkBreakdown', () => {
  const link = (href: string, hidden = false) => ({ href, hidden });

  it('splits addresses into same site, other sites and other kinds', () => {
    expect(
      linkBreakdown(
        [
          link('https://www.shop.com/a'),
          link('https://shop.com/b'),
          link('https://other.com/'),
          link('mailto:hi@shop.com'),
          link('tel:123'),
        ],
        PAGE,
      ),
    ).toEqual({
      total: 5,
      sameSite: 2,
      otherSites: 1,
      otherKinds: 2,
      hidden: 0,
      duplicates: 0,
    });
  });

  it('counts every link it is given, so the parts add up to the Links stat', () => {
    const result = linkBreakdown(
      [
        link('https://shop.com/a'),
        link('https://shop.com/a'),
        link('https://other.com/'),
      ],
      PAGE,
    );
    expect(result.total).toBe(3);
    expect(result.sameSite + result.otherSites + result.otherKinds).toBe(3);
    expect(result.duplicates).toBe(1);
  });

  it('counts the hidden links among them', () => {
    const result = linkBreakdown(
      [
        link('https://shop.com/a', true),
        link('https://shop.com/a', false),
        link('https://shop.com/b', true),
      ],
      PAGE,
    );
    expect(result.hidden).toBe(2);
  });

  it('reads a relative address against the page', () => {
    expect(linkBreakdown([link('/about')], PAGE).sameSite).toBe(1);
  });
});

describe('headingCounts', () => {
  it('takes the H1 count from the whole page, not the listed headings', () => {
    expect(
      headingCounts({
        h1Count: 3,
        headings: {
          total: 300,
          items: [
            { level: 2, text: 'B' },
            { level: 1, text: 'C' },
          ],
        },
      }),
    ).toEqual({ h1: 3, total: 300 });
  });
});

describe('lengthState', () => {
  it.each([
    [0, 'missing'],
    [10, 'short'],
    [50, 'ok'],
    [160, 'ok'],
    [161, 'long'],
  ] as const)('%i characters is %s', (length, state) => {
    expect(lengthState(length, 50, 160)).toBe(state);
  });
});

describe('canonicalState', () => {
  it('is none without a canonical', () => {
    expect(canonicalState(PAGE, null)).toBe('none');
  });

  it('is same for the page itself, ignoring a trailing slash and hash', () => {
    expect(canonicalState(PAGE, 'https://www.shop.com/products/')).toBe('same');
    expect(canonicalState(`${PAGE}#top`, PAGE)).toBe('same');
  });

  it('is other for another address', () => {
    expect(canonicalState(PAGE, 'https://www.shop.com/')).toBe('other');
  });
});

describe('hostOf', () => {
  it('gives the host without www', () => {
    expect(hostOf(PAGE)).toBe('shop.com');
  });

  it('gives the text back when it is not an address', () => {
    expect(hostOf('not a url')).toBe('not a url');
  });
});

describe('outline', () => {
  const headings = Array.from({ length: 9 }, (_, index) => ({
    level: 2,
    text: `H${index}`,
  }));

  it('keeps the first headings and counts the rest', () => {
    const result = outline({ total: 24, items: headings }, 6);
    expect(result.shown).toHaveLength(6);
    expect(result.more).toBe(18);
  });

  it('has nothing more for a short list', () => {
    expect(outline({ total: 2, items: headings.slice(0, 2) }, 6).more).toBe(0);
  });
});
