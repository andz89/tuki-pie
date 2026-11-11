// Runs inside the website, so it must stay one expression with no imports.
// It trims to the limits in shared/schemas/page-info.schema.ts, so a large page
// is cut down instead of being refused.
(() => {
  const MAX_URL = 2048;
  const MAX_TEXT = 2000;
  const MAX_LIST = 5000;
  const MAX_HEADING = 120;

  // Tracker detection only needs the script text around these words: every
  // inline pattern in shared/page-audit.ts contains one (a test checks).
  // Sending whole scripts meant up to 100 MB per read, and the app froze on
  // pages built to be slow to search.
  const TRACKER_WORDS =
    /fbq|GTM-|gtag|ttq|_linkedin_partner_id|pintrk|UET|clarity|hjid|vgo/g;
  // The longest pattern spans 2000 characters on either side of its word.
  const BEFORE_WORD = 2100;
  const AFTER_WORD = 4200;
  const MAX_TRACKER_TEXT = 100000;

  // Pieces of inline script that can hold a tracker ID. A word close after
  // the last piece's word is already inside that piece.
  const trackerText = (scripts) => {
    const pieces = [];
    let total = 0;
    for (const script of scripts) {
      let lastWord = -Infinity;
      for (const { index } of script.matchAll(TRACKER_WORDS)) {
        if (index < lastWord + BEFORE_WORD) {
          continue;
        }
        lastWord = index;
        const piece = script
          .slice(Math.max(0, index - BEFORE_WORD), index + AFTER_WORD)
          .slice(0, MAX_TRACKER_TEXT - total);
        pieces.push(piece);
        total += piece.length;
        if (total >= MAX_TRACKER_TEXT) {
          return pieces;
        }
      }
    }
    return pieces;
  };

  const all = (selector) => [...document.querySelectorAll(selector)];
  const cut = (value) => value.slice(0, MAX_TEXT);
  // A page's own elements can stand in for these values: <img name="title">
  // replaces document.title, and <input name="action"> replaces form.action.
  const isText = (value) => typeof value === 'string' && value !== '';
  const orNull = (value) => (isText(value) ? cut(value) : null);
  const capped = (items) => items.slice(0, MAX_LIST);

  // Embedded data: files can be megabytes long, and are never worth reporting.
  const isUsableUrl = (url) =>
    isText(url) && !url.startsWith('data:') && url.length <= MAX_URL;

  const formAddress = (form) => {
    try {
      return new URL(form.getAttribute('action'), document.baseURI).href;
    } catch {
      return null;
    }
  };
  const usableUrls = (urls) => capped(urls.filter(isUsableUrl));

  const canonical = document.querySelector('link[rel="canonical"]')?.href;

  const squash = (text) => text.replace(/\s+/g, ' ').trim();
  // A logo in the H1 is a common pattern: its alt text is the heading then.
  const headingText = (heading) =>
    squash(heading.textContent) ||
    squash(
      [...heading.querySelectorAll('img[alt]')]
        .map((image) => image.alt)
        .join(' '),
    );
  const headings = all('h1, h2, h3, h4, h5, h6').map((heading) => ({
    level: Number(heading.tagName[1]),
    text: headingText(heading).slice(0, MAX_HEADING),
  }));

  const robots = all(
    'meta[name="robots" i][content], meta[name="googlebot" i][content]',
  ).map((tag) => ({
    name: cut(tag.name.toLowerCase()),
    content: cut(tag.content),
  }));

  const hreflang = all('link[rel="alternate" i][hreflang][href]')
    .map((tag) => ({
      hreflang: cut(tag.getAttribute('hreflang')),
      href: tag.href,
    }))
    .filter(({ href }) => isUsableUrl(href));

  // Files a browser loads by itself, which is what matters for mixed content.
  const resources = [
    ...all(
      'img[src], script[src], iframe[src], video[src], audio[src], source[src], embed[src]',
    ).map((tag) => ({ tag: tag.tagName.toLowerCase(), url: tag.src })),
    ...all(
      'link[href][rel~="stylesheet" i], link[href][rel~="icon" i], link[href][rel~="preload" i]',
    ).map((tag) => ({ tag: 'link', url: tag.href })),
    ...all('form[action]').map((tag) => ({
      tag: 'form',
      url: formAddress(tag),
    })),
  ].filter(({ url }) => isUsableUrl(url));

  // A pixel inside <noscript> is text, not an element, while scripts run.
  const noscriptSrcs = all('noscript').flatMap((tag) =>
    [...tag.innerHTML.matchAll(/src=["']([^"']+)["']/g)].map(([, src]) =>
      src.replace(/&amp;/g, '&'),
    ),
  );

  const unsafeBlankLinks = all('a[target="_blank" i][href]')
    .filter((link) => !/\bno(opener|referrer)\b/i.test(link.rel))
    .map((link) => link.href);

  // The links a person can follow, in page order. The app hides risky ones by
  // the user's Link filters. Kept in step with
  // packages/pie-extension/show-link.js, which finds them again by position.
  const LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:', 'sms:'];
  const isListedLink = (link) => {
    // WordPress's admin bar is only there for a logged-in editor.
    if (link.closest('#wpadminbar')) {
      return false;
    }
    const href = link.href;
    if (!isUsableUrl(href) || href.endsWith('/#')) {
      return false;
    }
    try {
      return LINK_PROTOCOLS.includes(new URL(href).protocol);
    } catch {
      return false;
    }
  };
  const hasBox = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  // A link can be 0x0 while its child (a floated image, say) shows.
  const isShown = (link) => {
    const style = getComputedStyle(link);
    if (
      style.display !== 'contents' &&
      link.checkVisibility &&
      !link.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    ) {
      return false;
    }
    return hasBox(link) || [...link.children].some(hasBox);
  };
  const listedLinks = capped(all('a[href]').filter(isListedLink));
  // Every link is measured before the list is built, so the page is laid
  // out once.
  const linkHidden = listedLinks.map((link) => !isShown(link));
  const links = listedLinks.map((link, index) => ({
    href: link.href,
    hidden: linkHidden[index],
  }));

  const featuredImages = ['og:image', 'twitter:image'].flatMap((property) => {
    const tag = document.querySelector(
      `meta[property="${property}"][content], meta[name="${property}"][content]`,
    );
    const url = tag?.getAttribute('content');
    return isUsableUrl(url) ? [{ property, url }] : [];
  });

  // Every web image on the page, each address once, in page order.
  const images = capped([
    ...new Set(
      all('img[src]')
        .map((image) => image.src)
        .filter((src) => isUsableUrl(src) && /^https?:/i.test(src)),
    ),
  ]);

  const hyvor = document.querySelector('hyvor-talk-comments');

  return {
    url: location.href.slice(0, MAX_URL),
    meta: {
      title: orNull(document.title),
      description: orNull(
        document.querySelector('meta[name="description"]')?.content,
      ),
      lang: orNull(document.documentElement.lang),
      canonical: isUsableUrl(canonical) ? canonical : null,
    },
    robots: capped(robots),
    headings: capped(headings),
    hreflang: capped(hreflang),
    resources: capped(resources),
    trackingSources: {
      srcs: usableUrls([
        ...all('script[src], img[src], iframe[src]').map((tag) => tag.src),
        ...noscriptSrcs,
      ]),
      inlineScripts: trackerText(
        all('script:not([src])').map((tag) => tag.textContent),
      ),
    },
    linkHrefs: usableUrls(all('a[href]').map((link) => link.href)),
    links,
    unsafeBlankLinks: usableUrls([...new Set(unsafeBlankLinks)]),
    featuredImages,
    images,
    hyvorTalk: hyvor
      ? {
          tagName: cut(hyvor.tagName),
          attributes: capped(
            [...hyvor.attributes].map(({ name, value }) => ({
              name: cut(name),
              value: cut(value),
            })),
          ),
        }
      : null,
  };
})();
