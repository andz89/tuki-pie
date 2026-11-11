import { describe, expect, it } from 'vitest';
import {
  checkHeadings,
  checkHreflang,
  checkMetaLengths,
  checkRobots,
  checkUtmLinks,
  detectTrackers,
  findMixedContent,
  limitList,
} from './page-audit';
import type { PageIssue } from './page-audit';

const areas = (issues: PageIssue[]) =>
  issues.map(({ level, area }) => `${level}:${area}`);

describe('checkMetaLengths', () => {
  it('accepts good lengths', () => {
    expect(
      checkMetaLengths({ title: 'Short title', description: 'x'.repeat(100) }),
    ).toEqual([]);
  });

  it('warns about a long title', () => {
    expect(
      areas(checkMetaLengths({ title: 'x'.repeat(61), description: null })),
    ).toEqual(['warning:Title']);
  });

  it('warns about a long description', () => {
    expect(
      areas(checkMetaLengths({ title: null, description: 'x'.repeat(161) })),
    ).toEqual(['warning:Description']);
  });

  it('warns about a short description', () => {
    expect(
      areas(checkMetaLengths({ title: null, description: 'too short' })),
    ).toEqual(['warning:Description']);
  });
});

describe('checkRobots', () => {
  it('treats noindex as an error', () => {
    expect(
      areas(checkRobots([{ name: 'robots', content: 'NOINDEX, follow' }])),
    ).toEqual(['error:Robots']);
  });

  it('treats none as an error', () => {
    expect(areas(checkRobots([{ name: 'robots', content: 'none' }]))).toEqual([
      'error:Robots',
    ]);
  });

  it('treats nofollow as a warning', () => {
    expect(
      areas(checkRobots([{ name: 'googlebot', content: 'index, nofollow' }])),
    ).toEqual(['warning:Robots']);
  });

  it('accepts index and follow', () => {
    expect(checkRobots([{ name: 'robots', content: 'index, follow' }])).toEqual(
      [],
    );
  });
});

describe('checkHeadings', () => {
  it('accepts a good outline', () => {
    expect(
      checkHeadings([
        { level: 1, text: 'A' },
        { level: 2, text: 'B' },
        { level: 3, text: 'C' },
        { level: 2, text: 'D' },
      ]),
    ).toEqual([]);
  });

  it('reports a missing H1', () => {
    expect(areas(checkHeadings([{ level: 2, text: 'A' }]))).toEqual([
      'error:Headings',
    ]);
  });

  it('reports more than one H1', () => {
    const [issue] = checkHeadings([
      { level: 1, text: 'A' },
      { level: 1, text: 'B' },
    ]);
    expect(issue.message).toBe(
      '2 H1 headings; a page usually has exactly one.',
    );
  });

  it('reports a skipped level', () => {
    const [issue] = checkHeadings([
      { level: 1, text: 'A' },
      { level: 4, text: 'Deep' },
    ]);
    expect(issue.message).toMatch(
      /H1 is followed by H4 \("Deep"\); H2 is skipped/,
    );
  });

  it('reports an empty heading', () => {
    const [issue] = checkHeadings([{ level: 1, text: '' }]);
    expect(issue.message).toMatch(/1 empty heading/);
  });
});

describe('checkHreflang', () => {
  it('accepts a valid set', () => {
    const tags = [
      { hreflang: 'de', href: 'https://example.com/de/' },
      { hreflang: 'en-GB', href: 'https://example.com/en/' },
      { hreflang: 'x-default', href: 'https://example.com/en/' },
    ];
    expect(
      checkHreflang(tags, {
        pageUrl: 'https://example.com/de#top',
        canonical: null,
      }),
    ).toEqual([]);
  });

  it('has nothing to say about a page with no tags', () => {
    expect(
      checkHreflang([], { pageUrl: 'https://example.com/', canonical: null }),
    ).toEqual([]);
  });

  it('reports duplicates, bad codes, no x-default and no self link', () => {
    const tags = [
      { hreflang: 'de', href: 'https://example.com/de' },
      { hreflang: 'DE', href: 'https://example.com/at' },
      { hreflang: 'german', href: 'https://example.com/x' },
    ];
    const messages = checkHreflang(tags, {
      pageUrl: 'https://example.com/fr',
      canonical: 'https://example.com/fr',
    })
      .map(({ message }) => message)
      .join('\n');
    expect(messages).toMatch(/"german" is not a valid language code/);
    expect(messages).toMatch(/"de" is listed 2 times/);
    expect(messages).toMatch(/No x-default/);
    expect(messages).toMatch(/No hreflang entry points to this page itself/);
  });
});

describe('detectTrackers', () => {
  it('finds trackers from script addresses and inline snippets', () => {
    const found = detectTrackers({
      srcs: [
        'https://connect.facebook.net/en_US/fbevents.js',
        'https://connect.facebook.net/en_US/fbevents.js',
        'https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ',
        'https://www.googletagmanager.com/gtag/js?id=AW-123456789',
        'https://www.googletagmanager.com/ns.html?id=GTM-WXYZ12',
        'https://www.facebook.com/tr?id=999&ev=PageView&noscript=1',
      ],
      inlineScripts: [
        "fbq('init', '1234567890'); fbq('track', 'PageView');",
        "ttq.load('C4ABCDEF'); ttq.page();",
        "(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:\"5555555\"};o.q=w[u],w[u]=new UET(o)}})(window,document,'script','//bat.bing.com/bat.js','uetq');",
        "vgo('setAccount', '650000000'); vgo('process');",
      ],
    });
    const byName = Object.fromEntries(found.map((t) => [t.name, t]));

    expect(byName['Meta Pixel'].ids.toSorted()).toEqual(['1234567890', '999']);
    expect(byName['Meta Pixel'].duplicateSrcs).toEqual([
      { src: 'https://connect.facebook.net/en_US/fbevents.js', count: 2 },
    ]);
    expect(byName['Google Analytics 4'].ids).toEqual(['G-ABC123XYZ']);
    expect(byName['Google Ads'].ids).toEqual(['AW-123456789']);
    expect(byName['Google Tag Manager'].ids).toEqual(['GTM-WXYZ12']);
    expect(byName['TikTok Pixel'].ids).toEqual(['C4ABCDEF']);
    expect(byName['Microsoft Ads (UET)'].ids).toEqual(['5555555']);
    expect(byName['ActiveCampaign Site Tracking'].ids).toEqual(['650000000']);
    expect(byName['Hotjar']).toBeUndefined();
  });

  it('stays fast on a script built to slow it down', () => {
    const inlineScripts = [
      'ti:1 new '.repeat(22000),
      'new UET({ '.repeat(20000),
    ];
    const startedAt = performance.now();
    detectTrackers({ srcs: [], inlineScripts });
    expect(performance.now() - startedAt).toBeLessThan(1000);
  });

  it('finds nothing on a plain page', () => {
    expect(
      detectTrackers({
        srcs: ['https://example.com/app.js'],
        inlineScripts: ["var ti = 5; console.log('hi')"],
      }),
    ).toEqual([]);
  });
});

describe('checkUtmLinks', () => {
  it('sorts complete, missing and empty values', () => {
    const result = checkUtmLinks([
      'https://example.com/',
      'https://example.com/a?utm_source=fb&utm_medium=cpc&utm_campaign=launch',
      'https://example.com/a?utm_source=fb&utm_medium=cpc&utm_campaign=launch',
      'https://example.com/b?utm_source=fb&utm_campaign=',
      'not a url',
    ]);
    expect(result.taggedCount).toBe(2);
    expect(result.campaigns).toEqual(['launch']);
    expect(result.problems).toEqual([
      {
        href: 'https://example.com/b?utm_source=fb&utm_campaign=',
        missing: ['utm_medium'],
        empty: ['utm_campaign'],
      },
    ]);
  });
});

describe('findMixedContent', () => {
  const resources = [
    { tag: 'img', url: 'http://cdn.example.com/a.png' },
    { tag: 'script', url: 'https://cdn.example.com/a.js' },
  ];

  it('finds http files on an https page', () => {
    expect(findMixedContent('https://example.com/', resources)).toEqual([
      resources[0],
    ]);
  });

  it('ignores an http page', () => {
    expect(findMixedContent('http://example.com/', resources)).toEqual([]);
  });
});

describe('limitList', () => {
  it('keeps the full total', () => {
    expect(limitList([1, 2, 3], 2)).toEqual({ total: 3, items: [1, 2] });
  });
});
