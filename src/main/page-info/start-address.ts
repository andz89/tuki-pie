import { z } from 'zod';
import { sameAddress } from '../../../packages/pie-extension/protocol.js';
import { MAX_PAGE_URL } from '../../shared/schemas/page-info.schema';
import { isSiteUrl } from './site-address';

export interface StartChoice {
  address: string;
  fromClipboard: boolean;
}

// What clicking the Page Info slice checks, always in Chrome. The active tab
// comes first, read as it is. Otherwise a newly copied address, if the Links
// rules would offer it (it opens in your logged-in Chrome without a click on
// it). Nothing loads again if the window already shows it.
export function chooseStartAddress({
  activeTab,
  copied,
  lastCopied,
  shown,
  isSafeToOpen,
}: {
  activeTab: string | null;
  copied: string | null;
  lastCopied: string | null;
  shown: string | null;
  isSafeToOpen: (address: string) => boolean;
}): StartChoice | null {
  if (activeTab !== null) {
    return shown !== null && sameAddress(activeTab, shown)
      ? null
      : { address: activeTab, fromClipboard: false };
  }
  if (
    copied !== null &&
    copied !== lastCopied &&
    copied !== shown &&
    isSafeToOpen(copied)
  ) {
    return { address: copied, fromClipboard: true };
  }
  return null;
}

const ActiveTab = z.object({ url: z.string().max(MAX_PAGE_URL) }).nullable();

// The extension's answer is untrusted, so only a plain web address counts.
export function activeTabAddress(answer: unknown): string | null {
  const parsed = ActiveTab.safeParse(answer);
  const url = parsed.success ? parsed.data?.url : undefined;
  return url !== undefined && isSiteUrl(url) ? url : null;
}
