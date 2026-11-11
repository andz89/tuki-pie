import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent } from 'react';
import { PieIcon, SliceIcon } from '../components/icons/SliceIcon';
import { CommentsCard } from './CommentsCard';
import { DetailsCard } from './DetailsCard';
import { readLinkFilter } from '../../shared/link-rules';
import { IssuesCard } from './IssuesCard';
import { LinkFilters } from './LinkFilters';
import { PageImages } from './PageImages';
import { PageDashboard } from './PageDashboard';
import type { PageInfoTab } from './PageDashboard';
import { PageLinks } from './PageLinks';
import { PageScreenshot } from './PageScreenshot';
import { includedLinks, shownLinks, uniqueLinks } from './page-links';
import type { LinkChoices } from './page-links';
import { useHighlightSearch } from './highlight-search';
import { SeoCard } from './SeoCard';
import { SocialCard } from './SocialCard';
import { SortableCards } from './SortableCards';
import { TrackingCard } from './TrackingCard';
import { usePageInfoStore } from './page-info.store';

const MAX_ADDRESS_LENGTH = 2048;

const TABS: { id: PageInfoTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'info', label: 'Page info' },
  { id: 'links', label: 'Links' },
  { id: 'images', label: 'Images' },
  { id: 'screenshot', label: 'Screenshot' },
];

export function PageInfoWindow() {
  const update = usePageInfoStore((state) => state.update);
  const problem = usePageInfoStore((state) => state.problem);
  const settings = usePageInfoStore((state) => state.settings);
  const start = usePageInfoStore((state) => state.start);
  const loadSettings = usePageInfoStore((state) => state.loadSettings);
  const check = usePageInfoStore((state) => state.check);
  const refresh = usePageInfoStore((state) => state.refresh);
  const goToTab = usePageInfoStore((state) => state.goToTab);
  const toggleOnTop = usePageInfoStore((state) => state.toggleOnTop);
  const setLinkFilter = usePageInfoStore((state) => state.setLinkFilter);

  const { status, address, report, message } = update;
  const { chromeConnected } = update;
  const onTop = settings.pageInfoOnTop === 'on-top';
  const linkFilter = useMemo(
    () => readLinkFilter(settings.linkFilter),
    [settings.linkFilter],
  );
  const [typed, setTyped] = useState('');
  const [tab, setTab] = useState<PageInfoTab>('dashboard');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(true);
  // The user's ticks in the Links list, until the next check.
  const [choices, setChoices] = useState<LinkChoices>(new Map());
  // The tab counts what the Links list shows.
  const listedLinks = report ? shownLinks(report.links, linkFilter) : [];
  const linkCount = includedLinks(
    hideDuplicates ? uniqueLinks(listedLinks) : listedLinks,
    choices,
    linkFilter,
  ).length;
  const choose = (href: string, included: boolean) =>
    setChoices((current) => new Map(current).set(href, included));
  // Ticks every plain link again; marked links keep their ticks.
  const includeAll = () =>
    setChoices(
      (current) => new Map([...current].filter(([, included]) => included)),
    );
  const [highlight, setHighlight] = useState('');
  const resultsRef = useRef<HTMLElement>(null);
  const matchCount = useHighlightSearch(resultsRef, highlight);
  const baseId = useId();
  const filtersId = `${baseId}-link-filters`;
  // Built-in rules and your words switched off, plus token marking.
  const rulesOff =
    linkFilter.off.length +
    linkFilter.words.filter(({ on }) => !on).length +
    (linkFilter.tokens ? 0 : 1);
  const tabIds = {
    dashboard: {
      tab: `${baseId}-dashboard-tab`,
      panel: `${baseId}-dashboard-panel`,
    },
    info: { tab: `${baseId}-info-tab`, panel: `${baseId}-info-panel` },
    links: { tab: `${baseId}-links-tab`, panel: `${baseId}-links-panel` },
    images: { tab: `${baseId}-images-tab`, panel: `${baseId}-images-panel` },
    screenshot: {
      tab: `${baseId}-screenshot-tab`,
      panel: `${baseId}-screenshot-panel`,
    },
  };

  const tabLabel = (id: PageInfoTab, label: string) => {
    if (!report || (id !== 'links' && id !== 'images')) {
      return label;
    }
    return `${label} (${id === 'links' ? linkCount : report.images.length})`;
  };

  // Arrow keys move between the tabs, as in any tab list.
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    const ids = TABS.map(({ id }) => id);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = ids[(ids.indexOf(tab) + step + ids.length) % ids.length];
    setTab(next);
    document.getElementById(tabIds[next].tab)?.focus();
  };

  useEffect(() => {
    void start();
    void loadSettings();
    const reloadLook = () => void loadSettings();
    window.addEventListener('focus', reloadLook);
    return () => window.removeEventListener('focus', reloadLook);
  }, [start, loadSettings]);

  // Counts the checks, so the dashboard plays its entrance for each one.
  const [checkCount, setCheckCount] = useState(0);
  // A new read of the page starts with every link included.
  useEffect(() => {
    setChoices(new Map());
    setCheckCount((count) => count + 1);
  }, [report]);

  useEffect(() => {
    if (address !== null) {
      setTyped(address);
    }
  }, [address]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void check(typed);
  };

  return (
    <div
      className="panel page-info"
      data-theme={settings.theme}
      style={{ '--accent': settings.accent } as CSSProperties}
    >
      <form className="page-info-bar" onSubmit={submit}>
        <div className="page-info-address-row">
          <input
            type="text"
            aria-label="Web address"
            placeholder="example.com"
            value={typed}
            maxLength={MAX_ADDRESS_LENGTH}
            onChange={(event) => setTyped(event.target.value)}
          />
          <button
            type="submit"
            className="button button-icon button-search"
            disabled={!chromeConnected || !typed.trim()}
            aria-label="Check in Chrome"
            title={chromeConnected ? 'Check in Chrome' : 'Chrome not connected'}
          >
            <SliceIcon type="search" x={0} y={0} />
          </button>
          <button
            type="button"
            className="button button-icon"
            disabled={address === null}
            aria-label="Refresh"
            title="Check the page again"
            onClick={() => void refresh()}
          >
            <SliceIcon type="refresh" x={0} y={0} />
          </button>
          <button
            type="button"
            className="button button-icon"
            disabled={address === null || !chromeConnected}
            aria-label="Go to tab"
            title="Go to the tab in Chrome"
            onClick={() => void goToTab()}
          >
            <SliceIcon type="open-tab" x={0} y={0} />
          </button>
          <button
            type="button"
            className={
              onTop ? 'button button-icon button-on' : 'button button-icon'
            }
            aria-pressed={onTop}
            aria-label="Keep on top"
            title={onTop ? 'Kept on top. Click to stop.' : 'Keep on top'}
            onClick={() => void toggleOnTop()}
          >
            <SliceIcon type={onTop ? 'pin' : 'pin-off'} x={0} y={0} />
          </button>
        </div>
        <div className="page-info-highlight">
          <div className="page-info-highlight-field">
            <span className="page-info-highlight-icon">
              <PieIcon type="search" size={14} />
            </span>
            <input
              type="search"
              value={highlight}
              placeholder="Highlight words in the results below"
              aria-label="Highlight words in the results"
              onChange={(event) => setHighlight(event.target.value)}
              onKeyDown={(event) => {
                // Enter here would start a check of the address.
                if (event.key === 'Enter') {
                  event.preventDefault();
                }
                if (event.key === 'Escape') {
                  setHighlight('');
                }
              }}
            />
            {highlight && (
              <button
                type="button"
                className="page-info-highlight-clear"
                aria-label="Clear highlight"
                title="Clear"
                onClick={() => setHighlight('')}
              >
                <PieIcon type="close" size={14} />
              </button>
            )}
          </div>
          {highlight.trim() && (
            <span className="page-info-highlight-count" role="status">
              {matchCount === 1 ? '1 match' : `${matchCount} matches`}
            </span>
          )}
        </div>
        <div
          className="info-tabs page-info-tabs"
          role="tablist"
          aria-label="Web Page"
          onKeyDown={onTabKey}
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={tabIds[id].tab}
              aria-selected={tab === id}
              aria-controls={tabIds[id].panel}
              tabIndex={tab === id ? 0 : -1}
              className={tab === id ? 'info-tab is-active' : 'info-tab'}
              onClick={() => setTab(id)}
            >
              {tabLabel(id, label)}
            </button>
          ))}
        </div>
      </form>

      <main className="page-info-content" ref={resultsRef}>
        {!chromeConnected && (
          <p className="page-info-address" role="status">
            Chrome not connected.
          </p>
        )}
        {address !== null && <p className="page-info-address">{address}</p>}
        {problem && <p role="alert">{problem}</p>}
        {status === 'checking' && <p role="status">Checking…</p>}
        {message && <p role="alert">{message}</p>}

        {/* All stay mounted, so filters survive a tab switch. */}
        {report && (
          <div
            role="tabpanel"
            id={tabIds.dashboard.panel}
            aria-labelledby={tabIds.dashboard.tab}
            hidden={tab !== 'dashboard'}
          >
            <PageDashboard
              key={checkCount}
              report={report}
              listedLinks={listedLinks}
              linkCount={linkCount}
              chromeConnected={chromeConnected}
              onOpen={setTab}
            />
          </div>
        )}
        {report && (
          <div
            role="tabpanel"
            id={tabIds.info.panel}
            aria-labelledby={tabIds.info.tab}
            className="page-info-panel"
            hidden={tab !== 'info'}
          >
            <SortableCards
              cards={{
                issues: <IssuesCard issues={report.issues} />,
                details: <DetailsCard meta={report.meta} />,
                seo: <SeoCard seo={report.seo} />,
                tracking: <TrackingCard tracking={report.tracking} />,
                social: (
                  <SocialCard
                    images={report.featuredImages}
                    pageUrl={report.url}
                  />
                ),
                comments: <CommentsCard hyvorTalk={report.hyvorTalk} />,
              }}
            />
          </div>
        )}
        {report && (
          <div
            role="tabpanel"
            id={tabIds.links.panel}
            aria-labelledby={tabIds.links.tab}
            hidden={tab !== 'links'}
          >
            <section className="info-card" aria-label="Links">
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
                  className={
                    filtersOpen ? 'link-button button-on' : 'link-button'
                  }
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
                links={report.links}
                linkFilter={linkFilter}
                hideDuplicates={hideDuplicates}
                choices={choices}
                onChoose={choose}
                onIncludeAll={includeAll}
                chromeConnected={chromeConnected}
              />
            </section>
          </div>
        )}
        {report && (
          <div
            role="tabpanel"
            id={tabIds.images.panel}
            aria-labelledby={tabIds.images.tab}
            hidden={tab !== 'images'}
          >
            <section className="info-card" aria-label="Images">
              <PageImages
                images={report.images}
                pageUrl={report.url}
                linkFilter={linkFilter}
                chromeConnected={chromeConnected}
              />
            </section>
          </div>
        )}
        {report && (
          <div
            role="tabpanel"
            id={tabIds.screenshot.panel}
            aria-labelledby={tabIds.screenshot.tab}
            hidden={tab !== 'screenshot'}
          >
            <section className="info-card" aria-label="Screenshot">
              <PageScreenshot chromeConnected={chromeConnected} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
