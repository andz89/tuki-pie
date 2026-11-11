import type { LimitedList, PageHeading } from '../../shared/page-audit';
import type { PageLink } from './page-links';

const withoutWww = (host: string) => host.replace(/^www\./i, '');

// The page's host for showing, without "www.", or the text as it came.
export function hostOf(url: string): string {
  return URL.canParse(url) ? withoutWww(new URL(url).hostname) : url;
}

// Counts every link it is given, so the parts add up to the Links stat when
// both come from the links the Links tab counts.
export interface LinkBreakdown {
  total: number;
  sameSite: number;
  otherSites: number;
  // mailto:, tel: and anything else that isn't a web address.
  otherKinds: number;
  // Links hidden on the page.
  hidden: number;
  // Extra copies of an address already counted.
  duplicates: number;
}

// "www." doesn't make another site.
export function linkBreakdown(
  links: PageLink[],
  pageUrl: string,
): LinkBreakdown {
  const pageHost = hostOf(pageUrl);
  const result: LinkBreakdown = {
    total: links.length,
    sameSite: 0,
    otherSites: 0,
    otherKinds: 0,
    hidden: 0,
    duplicates: links.length - new Set(links.map(({ href }) => href)).size,
  };
  for (const { href, hidden } of links) {
    if (hidden) {
      result.hidden += 1;
    }
    const url = URL.canParse(href, pageUrl) ? new URL(href, pageUrl) : null;
    if (!url || !/^https?:$/.test(url.protocol)) {
      result.otherKinds += 1;
    } else if (withoutWww(url.hostname) === pageHost) {
      result.sameSite += 1;
    } else {
      result.otherSites += 1;
    }
  }
  return result;
}

export function headingCounts({
  h1Count,
  headings,
}: {
  h1Count: number;
  headings: LimitedList<PageHeading>;
}): { h1: number; total: number } {
  return { h1: h1Count, total: headings.total };
}

export type LengthState = 'missing' | 'short' | 'ok' | 'long';

export function lengthState(
  length: number,
  min: number,
  max: number,
): LengthState {
  if (length === 0) {
    return 'missing';
  }
  if (length < min) {
    return 'short';
  }
  return length > max ? 'long' : 'ok';
}

const comparable = (url: string) => {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.href.replace(/\/$/, '');
};

export function canonicalState(
  pageUrl: string,
  canonical: string | null,
): 'none' | 'same' | 'other' {
  if (!canonical) {
    return 'none';
  }
  if (!URL.canParse(pageUrl) || !URL.canParse(canonical, pageUrl)) {
    return 'other';
  }
  const resolved = new URL(canonical, pageUrl).href;
  return comparable(resolved) === comparable(pageUrl) ? 'same' : 'other';
}

export function outline(
  headings: LimitedList<PageHeading>,
  max: number,
): { shown: PageHeading[]; more: number } {
  const shown = headings.items.slice(0, max);
  return { shown, more: headings.total - shown.length };
}
