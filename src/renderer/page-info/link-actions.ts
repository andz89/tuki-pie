import { createContext, useContext, useMemo } from 'react';
import type { LinkSpot, Result } from '../../shared/types';
import { pageInfoBridge } from './page-info-bridge';
import { usePageInfoStore } from './page-info.store';

// What the Links list does with a link outside itself. Web Page's own by
// default; the Links card on the Info Card provides its own.
export interface LinkActions {
  // Scroll to the link in Chrome and outline it.
  showLink(index: number, href: string): Promise<Result<LinkSpot | null>>;
  // Background tabs in Chrome.
  openInChrome(urls: string[], ticked: string[]): Promise<Result<boolean>>;
  // One link checked in its own Web Page tab.
  openHere(href: string, ticked: boolean): Promise<unknown>;
  // How "here" reads on the buttons: "here" and "in this window" on Web
  // Page, "in Web Page" on the card.
  here: { short: string; place: string };
  // Set: every Open and Open all go there, chosen with the Links card's
  // switch. Unset (Web Page): Open goes to Chrome, Ctrl+click here, and
  // Open all offers both.
  openTarget?: 'chrome' | 'here';
}

export const LinkActionsContext = createContext<LinkActions | null>(null);

const WEB_PAGE_HERE = { short: 'here', place: 'in this window' };

export function useLinkActions(): LinkActions {
  const provided = useContext(LinkActionsContext);
  const newTab = usePageInfoStore((state) => state.newTab);
  return useMemo(
    () =>
      provided ?? {
        showLink: (index, href) => pageInfoBridge.showLink(index, href),
        openInChrome: (urls, ticked) => pageInfoBridge.openLinks(urls, ticked),
        openHere: (href, ticked) => newTab(href, ticked),
        here: WEB_PAGE_HERE,
      },
    [provided, newTab],
  );
}
