import { describe, expect, it } from 'vitest';
import type { PageData } from '../../shared/types';
import { buildPageReport } from './page-report';

const PAGE: PageData = {
  url: 'https://example.com/',
  meta: { title: 'Hi', description: null, lang: 'en', canonical: null },
  robots: [],
  headings: [{ level: 1, text: 'Hi' }],
  hreflang: [],
  resources: [],
  trackingSources: { srcs: [], inlineScripts: [] },
  linkHrefs: [],
  links: [],
  unsafeBlankLinks: [],
  featuredImages: [],
  images: [],
  hyvorTalk: null,
};

const repeat = <Item>(count: number, make: (index: number) => Item) =>
  Array.from({ length: count }, (_, index) => make(index));

describe('buildPageReport', () => {
  it.each([[{ nope: 1 }], ['text'], [null]])('returns null for %j', (raw) => {
    expect(buildPageReport(raw)).toBeNull();
  });

  it('keeps the page details', () => {
    expect(buildPageReport(PAGE)?.meta.title).toBe('Hi');
  });

  it('limits headings to 200 and keeps the total', () => {
    const headings = repeat(250, () => ({ level: 2, text: 'x' }));
    const report = buildPageReport({ ...PAGE, headings });
    expect(report?.seo.headings.total).toBe(250);
    expect(report?.seo.headings.items).toHaveLength(200);
  });

  it('counts H1s past the first 200 headings', () => {
    const headings = [
      ...repeat(250, () => ({ level: 2, text: 'x' })),
      { level: 1, text: 'Late' },
    ];
    const report = buildPageReport({ ...PAGE, headings });
    expect(report?.seo.h1Count).toBe(1);
  });

  it('limits hreflang to 100', () => {
    const hreflang = repeat(120, (n) => ({
      hreflang: 'de',
      href: `https://example.com/${n}`,
    }));
    const report = buildPageReport({ ...PAGE, hreflang });
    expect(report?.seo.hreflang.items).toHaveLength(100);
  });

  it('limits mixed content to 50', () => {
    const resources = repeat(60, (n) => ({
      tag: 'img',
      url: `http://example.com/${n}.png`,
    }));
    const report = buildPageReport({ ...PAGE, resources });
    expect(report?.tracking.mixedContent.total).toBe(60);
    expect(report?.tracking.mixedContent.items).toHaveLength(50);
  });

  it('collects every issue into one list', () => {
    const report = buildPageReport({
      ...PAGE,
      resources: [{ tag: 'img', url: 'http://example.com/a.png' }],
    });
    expect(report?.issues.map(({ area }) => area)).toContain('Mixed content');
  });

  it('reports a missing H1', () => {
    const report = buildPageReport({ ...PAGE, headings: [] });
    expect(report?.issues[0]).toMatchObject({
      level: 'error',
      message: 'No H1 heading on the page.',
    });
  });

  it('finds trackers', () => {
    const report = buildPageReport({
      ...PAGE,
      trackingSources: {
        srcs: ['https://static.hotjar.com/c/hotjar-77.js'],
        inlineScripts: [],
      },
    });
    expect(report?.tracking.trackers[0]).toMatchObject({
      name: 'Hotjar',
      ids: ['77'],
    });
  });
});
