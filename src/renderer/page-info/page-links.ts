import { isBlocked, isMarked } from '../../shared/link-rules';
import type { LinkFilter } from '../../shared/link-rules';
import type { PageReport } from '../../shared/types';

export type PageLink = PageReport['links'][number];

export interface NumberedLink extends PageLink {
  // The link's place among every link on the page, from 0, which "Show on
  // page" uses. It stays the same whatever is hidden or filtered.
  index: number;
}

// Every link, numbered, without those a Link filter hides.
export function shownLinks(
  links: PageLink[],
  linkFilter: LinkFilter,
): NumberedLink[] {
  return links
    .map((link, index) => ({ ...link, index }))
    .filter(({ href }) => !isBlocked(href, linkFilter));
}

// One link per address, in page order. The first copy shown on the page is
// kept, so "Show on page" finds one you can see; else the first copy.
export function uniqueLinks(links: NumberedLink[]): NumberedLink[] {
  const kept = new Map<string, NumberedLink>();
  for (const link of links) {
    const current = kept.get(link.href);
    if (!current || (current.hidden && !link.hidden)) {
      kept.set(link.href, link);
    }
  }
  return [...kept.values()].sort((a, b) => a.index - b.index);
}

// Ask before opening more tabs than this at once.
export const ASK_ABOVE = 15;

// A case-insensitive "address contains" match. Spaces split the text into
// words that must all appear; no words matches everything.
export function matchesAddress(address: string, filter: string): boolean {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = address.toLowerCase();
  return words.every((word) => lower.includes(word));
}

export function filterLinks(
  links: NumberedLink[],
  filter: string,
): NumberedLink[] {
  return links.filter(({ href }) => matchesAddress(href, filter));
}

export function isWebLink(href: string): boolean {
  return /^https?:/i.test(href);
}

// Web addresses, each once, in page order. Give it the included links.
export function openableUrls(links: PageLink[]): string[] {
  return [...new Set(links.map(({ href }) => href).filter(isWebLink))];
}

// Different addresses "Open all" skips because they carry a token or an ID.
export function countMarked(links: PageLink[], linkFilter: LinkFilter): number {
  return new Set(
    links.map(({ href }) => href).filter((href) => isMarked(href, linkFilter)),
  ).size;
}

export function countAddresses(links: PageLink[]): number {
  return new Set(links.map(({ href }) => href)).size;
}

// The user's ticks, by address. Without one, a link is ticked unless it is
// marked as carrying a token or an ID.
export type LinkChoices = ReadonlyMap<string, boolean>;

export function isIncluded(
  href: string,
  choices: LinkChoices,
  linkFilter: LinkFilter,
): boolean {
  return choices.get(href) ?? !isMarked(href, linkFilter);
}

// Links counted and opened by "Open all".
export function includedLinks<Link extends PageLink>(
  links: Link[],
  choices: LinkChoices,
  linkFilter: LinkFilter,
): Link[] {
  return links.filter(({ href }) => isIncluded(href, choices, linkFilter));
}
