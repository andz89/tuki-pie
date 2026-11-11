import type { LimitedList } from '../../shared/page-audit';
import { isWebLink } from '../../shared/schemas/shortcut.schema';

// The address comes from the website, so only web images are ever loaded.
export function shareImageSource(url: string, pageUrl: string): string | null {
  if (!URL.canParse(url, pageUrl)) {
    return null;
  }
  const { href } = new URL(url, pageUrl);
  return isWebLink(href) ? href : null;
}

export function moreNote(list: LimitedList<unknown>): string | null {
  return list.total > list.items.length
    ? `Showing ${list.items.length} of ${list.total}`
    : null;
}

export function isLengthOk(length: number, min: number, max: number): boolean {
  return length >= min && length <= max;
}
