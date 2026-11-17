import { useCallback, useId, useMemo, useState } from 'react';
import { readLinkFilter } from '../../shared/link-rules';
import type { LinksOpenIn } from '../../shared/schemas/info-card.schema';
import type { InfoCardState } from '../../shared/types';
import { LinkFilters } from '../page-info/LinkFilters';
import { PageLinks } from '../page-info/PageLinks';
import { LinkActionsContext } from '../page-info/link-actions';
import type { LinkActions } from '../page-info/link-actions';
import type { LinkChoices } from '../page-info/page-links';
import { HighlightField } from './HighlightField';
import { infoCardBridge } from './info-card-bridge';

const NO_CHOICES: LinkChoices = new Map();

// Web Page's "here" is a new site tab in its own window; from the card it
// is a tab in Web Page. Every Open follows the card's switch.
function cardActions(openIn: LinksOpenIn): LinkActions {
  return {
    showLink: (index, href) => infoCardBridge.showLink(index, href),
    openInChrome: (urls, ticked) => infoCardBridge.openLinks(urls, ticked),
    openHere: (href, ticked) => infoCardBridge.openHere(href, ticked),
    here: { short: 'in Web Page', place: 'in Web Page' },
    openTarget: openIn === 'web-page' ? 'here' : 'chrome',
  };
}

const OPEN_IN_NAMES: Record<LinksOpenIn, string> = {
  chrome: 'Chrome',
  'web-page': 'Web Page',
};

// The Links card: Web Page's Links tab for the page on the card, with the
// same Hide duplicates, Link filters and list.
export function LinksCard({ state }: { state: InfoCardState }) {
  const { page, pageId, status } = state;
  const [hideDuplicates, setHideDuplicates] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [highlight, setHighlight] = useState('');
  const filtersId = `${useId()}-link-filters`;
  // The user's ticks, for this page only: a new page starts fresh.
  const [ticks, setTicks] = useState<{ pageId: number; choices: LinkChoices }>({
    pageId,
    choices: NO_CHOICES,
  });
  const choices = ticks.pageId === pageId ? ticks.choices : NO_CHOICES;
  const linkFilter = useMemo(
    () => readLinkFilter(state.linkFilter),
    [state.linkFilter],
  );
  const actions = useMemo(
    () => cardActions(state.linksOpenIn),
    [state.linksOpenIn],
  );

  const choose = useCallback(
    (href: string, included: boolean) =>
      setTicks((current) => ({
        pageId,
        choices: new Map(
          current.pageId === pageId ? current.choices : NO_CHOICES,
        ).set(href, included),
      })),
    [pageId],
  );
  // Ticks every plain link again; marked links keep their ticks.
  const includeAll = useCallback(
    () =>
      setTicks((current) => ({
        pageId,
        choices: new Map(
          [
            ...(current.pageId === pageId ? current.choices : NO_CHOICES),
          ].filter(([, included]) => included),
        ),
      })),
    [pageId],
  );

  if (!page) {
    return null;
  }

  // Built-in rules and your words switched off, plus token marking.
  const rulesOff =
    linkFilter.off.length +
    linkFilter.words.filter(({ on }) => !on).length +
    (linkFilter.tokens ? 0 : 1);

  return (
    <LinkActionsContext.Provider value={actions}>
      <section className="info-card-links" aria-label="Links">
        {/* The card's settings, in one panel. */}
        <div className="links-controls">
          <div
            className="links-open-in"
            role="radiogroup"
            aria-label="Open links in"
          >
            <span>Open links in</span>
            <div className="links-open-in-choices">
              {(Object.keys(OPEN_IN_NAMES) as LinksOpenIn[]).map((each) => (
                <button
                  key={each}
                  type="button"
                  role="radio"
                  aria-checked={state.linksOpenIn === each}
                  className={
                    state.linksOpenIn === each
                      ? 'links-open-in-choice is-on'
                      : 'links-open-in-choice'
                  }
                  onClick={() => void infoCardBridge.setLinksOpenIn(each)}
                >
                  {OPEN_IN_NAMES[each]}
                </button>
              ))}
            </div>
          </div>
          <div className="link-filters-bar">
            <label className="filter-check">
              <input
                type="checkbox"
                checked={hideDuplicates}
                onChange={() => setHideDuplicates(!hideDuplicates)}
              />
              <span>Hide duplicates</span>
            </label>
            <button
              type="button"
              className={filtersOpen ? 'link-button button-on' : 'link-button'}
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              Link filters{rulesOff > 0 ? ` (${rulesOff} off)` : ''}
            </button>
          </div>
        </div>
        {filtersOpen && (
          <div id={filtersId} className="link-filters-panel">
            <LinkFilters
              filter={linkFilter}
              onChange={(filter) => void infoCardBridge.setLinkFilter(filter)}
            />
          </div>
        )}
        <HighlightField
          text={highlight}
          pageId={pageId}
          onChange={setHighlight}
        />
        <PageLinks
          pageKey={pageId}
          links={page.links}
          linkFilter={linkFilter}
          hideDuplicates={hideDuplicates}
          choices={choices}
          onChoose={choose}
          onIncludeAll={includeAll}
          chromeConnected={status !== 'not-connected'}
          highlight={highlight}
        />
      </section>
    </LinkActionsContext.Provider>
  );
}
