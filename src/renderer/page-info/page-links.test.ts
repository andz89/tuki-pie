import { describe, expect, it } from 'vitest';
import { DEFAULT_LINK_FILTER } from '../../shared/link-rules';
import {
  countAddresses,
  countMarked,
  filterLinks,
  includedLinks,
  isWebLink,
  openableUrls,
  shownLinks,
  uniqueLinks,
} from './page-links';

const link = (href: string, hidden = false) => ({ href, hidden });
const ALL_ON = DEFAULT_LINK_FILTER;

const LINKS = [
  link('https://a.com/About'),
  link('mailto:hi@a.com'),
  link('https://b.com/blog/about-us'),
  link('https://a.com/About'),
];

describe('shownLinks', () => {
  const page = [
    link('https://a.com/one'),
    link('https://a.com/posts/5/delete'),
    link('https://a.com/two'),
  ];

  it('hides what a filter matches and keeps page positions', () => {
    expect(shownLinks(page, ALL_ON).map(({ index }) => index)).toEqual([0, 2]);
  });

  it('shows a link once its rule is off', () => {
    const filter = { ...ALL_ON, off: ['action:delete'] };
    expect(shownLinks(page, filter)).toHaveLength(3);
  });
});

describe('uniqueLinks', () => {
  it('keeps one link per address, in page order', () => {
    expect(
      uniqueLinks(shownLinks(LINKS, ALL_ON)).map(({ index }) => index),
    ).toEqual([0, 1, 2]);
  });

  it('keeps the first copy shown on the page', () => {
    const page = [
      link('https://a.com/x', true),
      link('https://a.com/y'),
      link('https://a.com/x'),
      link('https://a.com/x'),
    ];
    expect(
      uniqueLinks(shownLinks(page, ALL_ON)).map(({ index }) => index),
    ).toEqual([1, 2]);
  });

  it('keeps the first copy when none is shown', () => {
    const page = [link('https://a.com/x', true), link('https://a.com/x', true)];
    expect(uniqueLinks(shownLinks(page, ALL_ON))).toEqual([
      { href: 'https://a.com/x', hidden: true, index: 0 },
    ]);
  });
});

describe('filterLinks', () => {
  const numbered = shownLinks(LINKS, ALL_ON);

  it('keeps every link with no filter', () => {
    expect(filterLinks(numbered, '  ').map(({ index }) => index)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('needs every word, ignoring case, and keeps page numbers', () => {
    expect(filterLinks(numbered, 'ABOUT blog')).toEqual([
      { href: 'https://b.com/blog/about-us', hidden: false, index: 2 },
    ]);
  });
});

describe('openableUrls', () => {
  it('keeps web addresses once each, in page order', () => {
    expect(openableUrls(LINKS)).toEqual([
      'https://a.com/About',
      'https://b.com/blog/about-us',
    ]);
  });
});

describe('countMarked', () => {
  it('counts different addresses that carry a token or an ID', () => {
    const page = [
      link('https://a.com/'),
      link('https://a.com/order?id=5'),
      link('https://a.com/order?id=5'),
      link('https://a.com/reset?token=x'),
    ];
    expect(countMarked(page, ALL_ON)).toBe(2);
    expect(countMarked(page, { ...ALL_ON, tokens: false })).toBe(0);
  });
});

describe('isWebLink', () => {
  it('tells web links from email and phone links', () => {
    expect(isWebLink('HTTPS://a.com')).toBe(true);
    expect(isWebLink('tel:123')).toBe(false);
  });
});

describe('countAddresses', () => {
  it('counts different addresses', () => {
    expect(countAddresses(LINKS)).toBe(3);
  });
});

describe('includedLinks', () => {
  const page = [link('https://a.com/About'), link('https://a.com/order?id=5')];

  it('ticks plain links and leaves marked ones unticked', () => {
    expect(includedLinks(page, new Map(), ALL_ON)).toEqual([page[0]]);
    expect(
      includedLinks(page, new Map(), { ...ALL_ON, tokens: false }),
    ).toEqual(page);
  });

  it('follows the ticks, for every copy of an address', () => {
    const choices = new Map([
      ['https://a.com/About', false],
      ['https://a.com/order?id=5', true],
    ]);
    expect(includedLinks([...page, page[0]], choices, ALL_ON)).toEqual([
      page[1],
    ]);
  });
});
