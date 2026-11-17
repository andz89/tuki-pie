import { canOpen } from '../../shared/link-rules';
import type { LinkFilter } from '../../shared/link-rules';
import type { InfoCardPage } from '../../shared/types';

// Most words one highlight sends to the page.
export const MAX_HIGHLIGHT_WORDS = 10;

// The highlight field's text as words, split on spaces as the list's own
// highlight does, without repeats.
export function highlightWords(text: string): string[] {
  return [...new Set(text.split(/\s+/).filter(Boolean))].slice(
    0,
    MAX_HIGHLIGHT_WORDS,
  );
}

// What the Links and Images cards may open: only links and images of the
// page on the card, and only those the saved Link filters let open, or that
// the user ticked, as on Web Page. The card window never names an address
// of its own.
export function allowedCardLinks(
  urls: string[],
  ticked: ReadonlySet<string>,
  page: InfoCardPage | null,
  filter: LinkFilter,
): string[] {
  if (!page) {
    return [];
  }
  const onPage = new Set([
    ...page.links.map(({ href }) => href),
    ...page.images,
  ]);
  return urls.filter(
    (url) => onPage.has(url) && canOpen(url, filter, ticked.has(url)),
  );
}
