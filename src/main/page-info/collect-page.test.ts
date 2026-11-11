// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { PageData as PageDataType } from '../../shared/types';
import { PageData } from '../../shared/schemas/page-info.schema';
import COLLECT_PAGE from './collect-page.js?raw';

function setPage(html: string): void {
  document.documentElement.innerHTML = html;
  document.documentElement.removeAttribute('lang');
}

function collect(): PageDataType {
  // The parentheses keep `return` on the script, past its opening comment.
  const expression = COLLECT_PAGE.trim().replace(/;$/, '');
  return new Function(`return (\n${expression}\n)`)() as PageDataType;
}

function read(html: string): PageDataType {
  setPage(html);
  return collect();
}

describe('collect-page', () => {
  it('reads the page details', () => {
    expect(
      read('<title>Hi</title><meta name="description" content="About">').meta,
    ).toMatchObject({ title: 'Hi', description: 'About' });
  });

  it('returns nulls for a bare page', () => {
    expect(read('').meta).toEqual({
      title: null,
      description: null,
      lang: null,
      canonical: null,
    });
  });

  it('reports where the page is', () => {
    expect(read('').url).toBe(location.href);
  });

  it('leaves out data: addresses', () => {
    const data = read(`<img src="data:image/png;base64,${'a'.repeat(50000)}">`);
    expect(data.resources).toEqual([]);
    expect(data.trackingSources.srcs).toEqual([]);
  });

  it('produces data the schema accepts for a huge page', () => {
    const huge = `<script>${'x'.repeat(300000)}</script><h1>${'y'.repeat(5000)}</h1><title>${'z'.repeat(5000)}</title>`;
    expect(PageData.safeParse(read(huge)).success).toBe(true);
  });

  it('collapses heading whitespace and cuts long headings', () => {
    const { headings } = read(
      `<h2>  one
        two </h2><h3>${'y'.repeat(200)}</h3>`,
    );
    expect(headings[0]).toEqual({ level: 2, text: 'one two' });
    expect(headings[1].text).toHaveLength(120);
  });

  it('finds robots and googlebot tags', () => {
    const { robots } = read(
      '<meta name="robots" content="noindex"><meta name="GoogleBot" content="nofollow">',
    );
    expect(robots).toEqual([
      { name: 'robots', content: 'noindex' },
      { name: 'googlebot', content: 'nofollow' },
    ]);
  });

  it('lists new-tab links without noopener', () => {
    const { unsafeBlankLinks } = read(
      '<a target="_blank" href="https://a.com/bad">x</a><a target="_blank" rel="noopener" href="https://a.com/good">y</a>',
    );
    expect(unsafeBlankLinks).toEqual(['https://a.com/bad']);
  });

  it('finds a pixel inside noscript', () => {
    const { trackingSources } = read(
      '<noscript><img src="https://www.facebook.com/tr?id=9&amp;ev=PageView"></noscript>',
    );
    expect(trackingSources.srcs).toContain(
      'https://www.facebook.com/tr?id=9&ev=PageView',
    );
  });

  it('finds share images by property or name', () => {
    const { featuredImages } = read(
      '<meta property="og:image" content="https://a.com/o.png"><meta name="twitter:image" content="https://a.com/t.png">',
    );
    expect(featuredImages).toEqual([
      { property: 'og:image', url: 'https://a.com/o.png' },
      { property: 'twitter:image', url: 'https://a.com/t.png' },
    ]);
  });

  it('lists web images once each, in page order', () => {
    const { images } = read(
      '<img src="https://a.com/one.png">' +
        '<img src="data:image/png;base64,aaaa">' +
        '<img src="blob:https://a.com/x">' +
        '<img src="https://a.com/two.jpg">' +
        '<img src="https://a.com/one.png">' +
        '<img>',
    );
    expect(images).toEqual(['https://a.com/one.png', 'https://a.com/two.jpg']);
  });

  it('reads the Hyvor Talk widget', () => {
    const { hyvorTalk } = read(
      '<hyvor-talk-comments website-id="12"></hyvor-talk-comments>',
    );
    expect(hyvorTalk?.attributes).toEqual([
      { name: 'website-id', value: '12' },
    ]);
  });

  it('survives a form with an input named action', () => {
    setPage('<form action="https://a.com/send"><input name="action"></form>');
    const form = document.querySelector('form') as HTMLFormElement;
    Object.defineProperty(form, 'action', {
      value: form.querySelector('input'),
    });
    expect(collect().resources).toContainEqual({
      tag: 'form',
      url: 'https://a.com/send',
    });
  });

  it('survives a link inside an SVG', () => {
    setPage('<svg><a href="https://a.com/s"></a></svg>');
    Object.defineProperty(document.querySelector('a'), 'href', {
      value: { baseVal: 'https://a.com/s' },
    });
    expect(collect().linkHrefs).toEqual([]);
  });

  it('lists followable links in page order, without the WordPress admin bar', () => {
    setPage(
      '<div id="wpadminbar"><a href="https://a.com/wp-admin">Admin</a></div>' +
        '<a href="https://a.com/one">1</a>' +
        '<a href="javascript:void(0)">js</a>' +
        '<a href="https://a.com/#">top</a>' +
        '<a href="mailto:hi@a.com">mail</a>',
    );
    // jsdom lays nothing out, so every link counts as hidden here.
    expect(collect().links).toEqual([
      { href: 'https://a.com/one', hidden: true },
      { href: 'mailto:hi@a.com', hidden: true },
    ]);
  });

  it('lists risky links too, which the app hides by Link filters', () => {
    setPage(
      '<a href="https://a.com/posts/5/delete">x</a><a href="https://a.com/wp-admin/">y</a>',
    );
    expect(collect().links.map(({ href }) => href)).toEqual([
      'https://a.com/posts/5/delete',
      'https://a.com/wp-admin/',
    ]);
  });

  it('survives an image named title', () => {
    setPage('<img name="title">');
    Object.defineProperty(document, 'title', {
      value: document.querySelector('img'),
      configurable: true,
    });
    try {
      expect(collect().meta.title).toBeNull();
    } finally {
      delete (document as unknown as { title?: unknown }).title;
    }
  });

  it('has no Hyvor Talk widget on a plain page', () => {
    expect(read('<p>hi</p>').hyvorTalk).toBeNull();
  });
});
