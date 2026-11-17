import { useMemo } from 'react';
import { readLinkFilter } from '../../shared/link-rules';
import type { InfoCardState } from '../../shared/types';
import { PageImages } from '../page-info/PageImages';
import { LinkActionsContext } from '../page-info/link-actions';
import type { LinkActions } from '../page-info/link-actions';
import { infoCardBridge } from './info-card-bridge';

// Images open only in Chrome: Web Page checks web pages, not image files.
const IMAGE_ACTIONS: LinkActions = {
  showLink: (index, href) => infoCardBridge.showLink(index, href),
  openInChrome: (urls, ticked) => infoCardBridge.openLinks(urls, ticked),
  openHere: (href, ticked) => infoCardBridge.openHere(href, ticked),
  here: { short: 'in Web Page', place: 'in Web Page' },
  openTarget: 'chrome',
};

// The Images card: Web Page's Images list for the page on the card, with
// the same search, broken count, viewer, Copy URL and Open.
export function ImagesCard({ state }: { state: InfoCardState }) {
  const { page, pageId, status } = state;
  const linkFilter = useMemo(
    () => readLinkFilter(state.linkFilter),
    [state.linkFilter],
  );
  if (!page) {
    return null;
  }
  return (
    <LinkActionsContext.Provider value={IMAGE_ACTIONS}>
      <section className="info-card-links" aria-label="Images">
        <PageImages
          pageKey={pageId}
          images={page.images}
          pageUrl={page.url}
          linkFilter={linkFilter}
          chromeConnected={status !== 'not-connected'}
        />
      </section>
    </LinkActionsContext.Provider>
  );
}
