// SEO and tracking checks on plain data read from a page, so they can be
// tested without a browser. Ported from the Tuki extension.

export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 160;
const LIST_LIMIT = 50;

export interface PageIssue {
  level: 'error' | 'warning';
  area: string;
  message: string;
}

export interface LimitedList<Item> {
  total: number;
  items: Item[];
}

export interface PageRobot {
  name: string;
  content: string;
}

export interface PageHeading {
  level: number;
  text: string;
}

export interface PageHreflang {
  hreflang: string;
  href: string;
}

export interface PageResource {
  tag: string;
  url: string;
}

export interface DetectedTracker {
  name: string;
  ids: string[];
  duplicateSrcs: Array<{ src: string; count: number }>;
}

export interface UtmProblem {
  href: string;
  missing: string[];
  empty: string[];
}

export interface UtmSummary {
  taggedCount: number;
  campaigns: string[];
  problems: UtmProblem[];
}

const issue = (
  level: PageIssue['level'],
  area: string,
  message: string,
): PageIssue => ({ level, area, message });

export function checkMetaLengths({
  title,
  description,
}: {
  title: string | null;
  description: string | null;
}): PageIssue[] {
  const issues: PageIssue[] = [];
  if (title && title.length > TITLE_MAX) {
    issues.push(
      issue(
        'warning',
        'Title',
        `Title is ${title.length} characters; search results usually cut it after about ${TITLE_MAX}.`,
      ),
    );
  }
  if (description && description.length > DESCRIPTION_MAX) {
    issues.push(
      issue(
        'warning',
        'Description',
        `Description is ${description.length} characters; search results usually cut it after about ${DESCRIPTION_MAX}.`,
      ),
    );
  } else if (description && description.length < DESCRIPTION_MIN) {
    issues.push(
      issue(
        'warning',
        'Description',
        `Description is only ${description.length} characters; aim for ${DESCRIPTION_MIN} to ${DESCRIPTION_MAX}.`,
      ),
    );
  }
  return issues;
}

export function checkRobots(robots: PageRobot[]): PageIssue[] {
  const issues: PageIssue[] = [];
  for (const { name, content } of robots) {
    const directives = content
      .toLowerCase()
      .split(',')
      .map((directive) => directive.trim());
    if (directives.includes('noindex') || directives.includes('none')) {
      issues.push(
        issue(
          'error',
          'Robots',
          `<meta name="${name}"> has "${content}": search engines will not list this page.`,
        ),
      );
    } else if (directives.includes('nofollow')) {
      issues.push(
        issue(
          'warning',
          'Robots',
          `<meta name="${name}"> has "${content}": search engines will not follow its links.`,
        ),
      );
    }
  }
  return issues;
}

// Headings are in page order.
export function checkHeadings(headings: PageHeading[]): PageIssue[] {
  const issues: PageIssue[] = [];
  const h1Count = headings.filter(({ level }) => level === 1).length;
  if (h1Count === 0) {
    issues.push(issue('error', 'Headings', 'No H1 heading on the page.'));
  } else if (h1Count > 1) {
    issues.push(
      issue(
        'warning',
        'Headings',
        `${h1Count} H1 headings; a page usually has exactly one.`,
      ),
    );
  }

  let previous = 0;
  for (const { level, text } of headings) {
    if (previous && level > previous + 1) {
      issues.push(
        issue(
          'warning',
          'Headings',
          `H${previous} is followed by H${level} ("${text || 'empty'}"); H${previous + 1} is skipped.`,
        ),
      );
    }
    previous = level;
  }

  const empty = headings.filter(({ text }) => !text).length;
  if (empty > 0) {
    issues.push(
      issue(
        'warning',
        'Headings',
        `${empty} empty heading${empty > 1 ? 's' : ''}.`,
      ),
    );
  }
  return issues;
}

const HREFLANG_PATTERN =
  /^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/i;

export function normalizeUrl(href: string): string {
  try {
    const url = new URL(href);
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return href;
  }
}

// Only checks this page's own tags. It can't tell whether the other language
// versions link back.
export function checkHreflang(
  hreflangs: PageHreflang[],
  { pageUrl, canonical }: { pageUrl: string; canonical: string | null },
): PageIssue[] {
  if (hreflangs.length === 0) {
    return [];
  }
  const issues: PageIssue[] = [];

  const seen = new Map<string, number>();
  for (const { hreflang } of hreflangs) {
    const code = hreflang.toLowerCase();
    seen.set(code, (seen.get(code) ?? 0) + 1);
    if (!HREFLANG_PATTERN.test(hreflang)) {
      issues.push(
        issue(
          'warning',
          'hreflang',
          `"${hreflang}" is not a valid language code (for example "de" or "de-AT").`,
        ),
      );
    }
  }
  for (const [code, count] of seen) {
    if (count > 1) {
      issues.push(
        issue('error', 'hreflang', `"${code}" is listed ${count} times.`),
      );
    }
  }

  if (!seen.has('x-default')) {
    issues.push(
      issue(
        'warning',
        'hreflang',
        "No x-default entry for visitors whose language isn't listed.",
      ),
    );
  }

  const self = new Set(
    [pageUrl, canonical]
      .filter((value): value is string => Boolean(value))
      .map(normalizeUrl),
  );
  if (!hreflangs.some(({ href }) => self.has(normalizeUrl(href)))) {
    issues.push(
      issue(
        'warning',
        'hreflang',
        'No hreflang entry points to this page itself.',
      ),
    );
  }
  return issues;
}

interface TrackerRule {
  name: string;
  src: RegExp[];
  inline: RegExp[];
}

// `src` matches script, image and iframe addresses. `inline` matches inline
// script text. A capture group, where present, is the account or pixel ID.
export const TRACKERS: TrackerRule[] = [
  {
    name: 'Meta Pixel',
    src: [
      /connect\.facebook\.net\/[^/]+\/fbevents\.js/,
      /facebook\.com\/tr\/?\?[^#]*\bid=(\d+)/,
    ],
    inline: [/fbq\(\s*['"]init['"]\s*,\s*['"](\d+)/g],
  },
  {
    name: 'Google Tag Manager',
    src: [
      /googletagmanager\.com\/(?:gtm\.js|ns\.html)\?[^#]*\bid=(GTM-[A-Z0-9]+)/,
    ],
    inline: [/['"](GTM-[A-Z0-9]+)['"]/g],
  },
  {
    name: 'Google Analytics 4',
    src: [/googletagmanager\.com\/gtag\/js\?[^#]*\bid=(G-[A-Z0-9]+)/],
    inline: [/gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)/g],
  },
  {
    name: 'Google Ads',
    src: [/googletagmanager\.com\/gtag\/js\?[^#]*\bid=(AW-[0-9]+)/],
    inline: [/gtag\(\s*['"]config['"]\s*,\s*['"](AW-[0-9]+)/g],
  },
  {
    name: 'TikTok Pixel',
    src: [/analytics\.tiktok\.com\//],
    inline: [/ttq\.load\(\s*['"]([A-Z0-9]+)/g],
  },
  {
    name: 'LinkedIn Insight',
    src: [
      /snap\.licdn\.com\//,
      /px\.ads\.linkedin\.com\/collect\/?\?[^#]*\bpid=(\d+)/,
    ],
    inline: [/_linkedin_partner_id\s*=\s*["']?(\d+)/g],
  },
  {
    name: 'Pinterest Tag',
    src: [/s\.pinimg\.com\/ct\/core\.js/],
    inline: [/pintrk\(\s*['"]load['"]\s*,\s*['"](\d+)/g],
  },
  {
    name: 'Microsoft Ads (UET)',
    src: [/bat\.bing\.com\//],
    inline: [
      // Bounded so a page can't build a script that freezes the whole app.
      /\bti\s*:\s*["']?(\d+)[^]{0,2000}?new\s+UET\(|new\s+UET\(\s*\{[^}]{0,2000}\bti\s*:\s*["']?(\d+)/g,
    ],
  },
  {
    name: 'Microsoft Clarity',
    src: [/clarity\.ms\/tag\/(\w+)/],
    inline: [/["']clarity["']\s*,\s*["']script["']\s*,\s*["'](\w+)["']/g],
  },
  {
    name: 'Hotjar',
    src: [/static\.hotjar\.com\/c\/hotjar-(\d+)\.js/, /static\.hotjar\.com\//],
    inline: [/\bhjid\s*:\s*(\d+)/g],
  },
  {
    name: 'ActiveCampaign Site Tracking',
    src: [
      /trackcmp\.net\//,
      /diffuser-cdn\.app-us1\.com\//,
      /prism\.app-us1\.com\//,
    ],
    inline: [/vgo\(\s*['"]setAccount['"]\s*,\s*['"](\d+)/g],
  },
];

// A pattern may have alternatives, each with its own ID group.
function addId(ids: Set<string>, match: RegExpMatchArray): void {
  const id = match.slice(1).find(Boolean);
  if (id) {
    ids.add(id);
  }
}

// The most inline script text searched per page. collect-page.js sends no
// more than this (only the text around tracker words); an older extension
// that sends whole scripts is cut here, so a page can't stall the app.
export const MAX_TRACKER_TEXT = 100000;

function capText(texts: string[]): string[] {
  const kept: string[] = [];
  let total = 0;
  for (const text of texts) {
    if (total >= MAX_TRACKER_TEXT) {
      break;
    }
    const piece = text.slice(0, MAX_TRACKER_TEXT - total);
    kept.push(piece);
    total += piece.length;
  }
  return kept;
}

// A tracker script loaded more than once usually double-counts events.
export function detectTrackers({
  srcs,
  inlineScripts,
}: {
  srcs: string[];
  inlineScripts: string[];
}): DetectedTracker[] {
  const found: DetectedTracker[] = [];
  for (const tracker of TRACKERS) {
    const ids = new Set<string>();
    const srcCounts = new Map<string, number>();
    let hit = false;

    for (const src of srcs) {
      for (const pattern of tracker.src) {
        const match = src.match(pattern);
        if (!match) {
          continue;
        }
        hit = true;
        addId(ids, match);
        srcCounts.set(src, (srcCounts.get(src) ?? 0) + 1);
        break;
      }
    }
    for (const text of capText(inlineScripts)) {
      for (const pattern of tracker.inline) {
        for (const match of text.matchAll(pattern)) {
          hit = true;
          addId(ids, match);
        }
      }
    }

    if (hit) {
      const duplicateSrcs = [...srcCounts]
        .filter(([, count]) => count > 1)
        .map(([src, count]) => ({ src, count }));
      found.push({ name: tracker.name, ids: [...ids], duplicateSrcs });
    }
  }
  return found;
}

const REQUIRED_UTM = ['utm_source', 'utm_medium', 'utm_campaign'];

// Looks only at links that carry at least one utm_ value.
export function checkUtmLinks(hrefs: string[]): UtmSummary {
  const tagged: string[] = [];
  const campaigns = new Set<string>();
  const problems: UtmProblem[] = [];

  for (const href of new Set(hrefs)) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    const utm = [...url.searchParams].filter(([key]) =>
      key.toLowerCase().startsWith('utm_'),
    );
    if (utm.length === 0) {
      continue;
    }
    tagged.push(href);

    const params = new Map(
      utm.map(([key, value]) => [key.toLowerCase(), value.trim()]),
    );
    const campaign = params.get('utm_campaign');
    if (campaign) {
      campaigns.add(campaign);
    }

    const missing = REQUIRED_UTM.filter((key) => !params.has(key));
    const empty = [...params].filter(([, value]) => !value).map(([key]) => key);
    if (missing.length || empty.length) {
      problems.push({ href, missing, empty });
    }
  }

  return { taggedCount: tagged.length, campaigns: [...campaigns], problems };
}

export function findMixedContent(
  pageUrl: string,
  resources: PageResource[],
): PageResource[] {
  if (!pageUrl.startsWith('https:')) {
    return [];
  }
  return resources.filter(({ url }) => url.startsWith('http:'));
}

// The total is always the full number, even when the list is cut short.
export function limitList<Item>(
  items: Item[],
  limit = LIST_LIMIT,
): LimitedList<Item> {
  return { total: items.length, items: items.slice(0, limit) };
}
