import { useId, useState } from 'react';
import type { LinkFilter } from '../../shared/link-rules';
import { LinkFilters } from './LinkFilters';
import { PageLinks } from './PageLinks';
import { usePageInfoStore } from './page-info.store';
import type { LinkChoices, PageLink } from './page-links';

interface LinksTabProps {
  pageKey: number;
  links: PageLink[];
  linkFilter: LinkFilter;
  // Kept by the window, as the tab's count and the dashboard use them too.
  hideDuplicates: boolean;
  onHideDuplicates: (hide: boolean) => void;
  choices: LinkChoices;
  onChoose: (href: string, included: boolean) => void;
  onIncludeAll: () => void;
  chromeConnected: boolean;
}

// The Links tab: the duplicates switch, the Link filters panel and the list.
export function LinksTab({
  pageKey,
  links,
  linkFilter,
  hideDuplicates,
  onHideDuplicates,
  choices,
  onChoose,
  onIncludeAll,
  chromeConnected,
}: LinksTabProps) {
  const setLinkFilter = usePageInfoStore((state) => state.setLinkFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = `${useId()}-link-filters`;
  // Built-in rules and your words switched off, plus token marking.
  const rulesOff =
    linkFilter.off.length +
    linkFilter.words.filter(({ on }) => !on).length +
    (linkFilter.tokens ? 0 : 1);

  return (
    <section className="info-card" aria-label="Links">
      <div className="link-filters-bar">
        <label className="filter-check">
          <input
            type="checkbox"
            checked={hideDuplicates}
            onChange={() => onHideDuplicates(!hideDuplicates)}
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
      {filtersOpen && (
        <div id={filtersId} className="link-filters-panel">
          <LinkFilters
            filter={linkFilter}
            onChange={(filter) => void setLinkFilter(filter)}
          />
        </div>
      )}
      <PageLinks
        pageKey={pageKey}
        links={links}
        linkFilter={linkFilter}
        hideDuplicates={hideDuplicates}
        choices={choices}
        onChoose={onChoose}
        onIncludeAll={onIncludeAll}
        chromeConnected={chromeConnected}
      />
    </section>
  );
}
