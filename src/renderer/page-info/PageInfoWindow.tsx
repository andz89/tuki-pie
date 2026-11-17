import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { readLinkFilter } from '../../shared/link-rules';
import { LinksTab } from './LinksTab';
import { PageImages } from './PageImages';
import { PageInfoCards } from './PageInfoCards';
import { PageDashboard } from './PageDashboard';
import type { PageInfoTab } from './PageDashboard';
import { PageScreenshot } from './PageScreenshot';
import { includedLinks, shownLinks, uniqueLinks } from './page-links';
import type { LinkChoices } from './page-links';
import { HistoryDialog } from './HistoryDialog';
import { AddressBar, HighlightBox } from './PageInfoBar';
import { SiteTabs } from './SiteTabs';
import { ConfirmBar } from '../components/ConfirmBar';
import { SavedSites } from '../saved-sites/SavedSites';
import { useSavedSitesStore } from '../saved-sites/saved-sites.store';
import { savedDate } from '../saved-sites/saved-view';
import { hostOf } from './page-dashboard';
import { SocialCard } from './SocialCard';
import { pageInfoBridge } from './page-info-bridge';
import { usePageInfoStore } from './page-info.store';

const NO_CHOICES: LinkChoices = new Map();

// The record without closed tabs; the same record when none closed.
function onlyOpen<V>(
  record: Record<string, V>,
  open: Set<string>,
): Record<string, V> {
  const ids = Object.keys(record);
  if (ids.every((id) => open.has(id))) {
    return record;
  }
  return Object.fromEntries(
    Object.entries(record).filter(([id]) => open.has(id)),
  );
}

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

  const { status, address, report, message } = update;
  const { chromeConnected, reportId, tabId } = update;
  const linkFilter = useMemo(
    () => readLinkFilter(settings.linkFilter),
    [settings.linkFilter],
  );
  // Each site tab keeps its own inner tab and ticks.
  const [innerTabs, setInnerTabs] = useState<Record<string, PageInfoTab>>({});
  const tab = innerTabs[tabId] ?? 'dashboard';
  const setTab = useCallback(
    (next: PageInfoTab) =>
      setInnerTabs((current) => ({ ...current, [tabId]: next })),
    [tabId],
  );
  const [hideDuplicates, setHideDuplicates] = useState(true);
  // The user's ticks in the Links list, until the next check.
  const [allChoices, setAllChoices] = useState<Record<string, LinkChoices>>({});
  const choices = useMemo(
    () => allChoices[tabId] ?? NO_CHOICES,
    [allChoices, tabId],
  );
  const setChoices = useCallback(
    (change: (current: LinkChoices) => LinkChoices) =>
      setAllChoices((all) => ({
        ...all,
        [tabId]: change(all[tabId] ?? NO_CHOICES),
      })),
    [tabId],
  );
  // The tab counts what the Links list shows. Worked out only when the links,
  // filters or ticks change: a page can have 5000 links.
  const reportLinks = report?.links;
  const listedLinks = useMemo(
    () => (reportLinks ? shownLinks(reportLinks, linkFilter) : []),
    [reportLinks, linkFilter],
  );
  // One list for the tab's count and every link number on the dashboard.
  const countedLinks = useMemo(
    () =>
      includedLinks(
        hideDuplicates ? uniqueLinks(listedLinks) : listedLinks,
        choices,
        linkFilter,
      ),
    [listedLinks, hideDuplicates, choices, linkFilter],
  );
  const linkCount = countedLinks.length;
  const choose = useCallback(
    (href: string, included: boolean) =>
      setChoices((current) => new Map(current).set(href, included)),
    [setChoices],
  );
  // Ticks every plain link again; marked links keep their ticks.
  const includeAll = useCallback(
    () =>
      setChoices(
        (current) => new Map([...current].filter(([, included]) => included)),
      ),
    [setChoices],
  );
  const resultsRef = useRef<HTMLElement>(null);
  const baseId = useId();
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

  // A new page starts with every link included. A re-read of the same page,
  // which only adds late tags, keeps your ticks, and so does a switch to
  // another tab and back. Page ids are never shared between tabs.
  const shownPage = useRef<Record<string, number>>({});
  useEffect(() => {
    const before = shownPage.current[tabId];
    shownPage.current[tabId] = reportId;
    if (before !== undefined && before !== reportId) {
      setChoices(() => NO_CHOICES);
    }
  }, [tabId, reportId, setChoices]);

  // The saved list can take this tab's place. Its list also tells Save
  // whether this address is saved already.
  const startSaved = useSavedSitesStore((state) => state.start);
  useEffect(() => void startSaved(), [startSaved]);
  const [view, setView] = useState<'tabs' | 'saved'>('tabs');
  // A saved site opened live from the other window shows the tabs again.
  useEffect(() => pageInfoBridge.onShowTabs(() => setView('tabs')), []);
  const [askShowHere, setAskShowHere] = useState(false);
  const closeTab = usePageInfoStore((state) => state.closeTab);
  const saveQuestion = usePageInfoStore((state) => state.saveQuestion);
  const saveNotice = usePageInfoStore((state) => state.saveNotice);
  const saveSite = usePageInfoStore((state) => state.saveSite);
  const cancelSave = usePageInfoStore((state) => state.cancelSave);
  const showSavedHere = () => {
    setAskShowHere(false);
    void closeTab(tabId);
    setView('saved');
  };
  // Asked first when the tab has something to lose.
  const askToShowSavedHere = () => {
    if (address === null && report === null) {
      showSavedHere();
    } else {
      setAskShowHere(true);
    }
  };

  // A closed tab's inner tab and ticks go with it.
  const openTabs = usePageInfoStore((state) => state.tabs.tabs);
  useEffect(() => {
    if (openTabs.length === 0) {
      return; // Not known yet.
    }
    const open = new Set(openTabs.map(({ id }) => id));
    setInnerTabs((current) => onlyOpen(current, open));
    setAllChoices((current) => onlyOpen(current, open));
    shownPage.current = onlyOpen(shownPage.current, open);
  }, [openTabs]);

  if (view === 'saved') {
    return (
      <div
        className="panel page-info page-info-saved"
        data-theme={settings.theme}
      >
        <SavedSites onBack={() => setView('tabs')} />
      </div>
    );
  }

  return (
    <div
      className="panel page-info"
      data-theme={settings.theme}
      style={{ '--accent': settings.accent } as CSSProperties}
    >
      <HistoryDialog />
      <div className="page-info-bar">
        <SiteTabs />
        <AddressBar key={tabId} onShowSavedHere={askToShowSavedHere} />
        {askShowHere && (
          <ConfirmBar
            message={`Show saved sites here? This closes the current tab (${hostOf(address ?? '')}) and its results.`}
            confirm="Show here"
            onConfirm={showSavedHere}
            onCancel={() => setAskShowHere(false)}
          />
        )}
        {saveQuestion && (
          <ConfirmBar
            message={`${hostOf(saveQuestion.address)} is already saved (${savedDate(saveQuestion.savedAt, true)}). Replace the saved results? Your note is kept.`}
            confirm="Replace"
            onConfirm={() => void saveSite(true)}
            onCancel={cancelSave}
          />
        )}
        {saveNotice && (
          <p className="page-info-notice" role="status">
            {saveNotice}
          </p>
        )}
        <HighlightBox resultsRef={resultsRef} />
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
      </div>

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
              key={`${tabId}:${reportId}`}
              report={report}
              countedLinks={countedLinks}
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
            <PageInfoCards
              report={report}
              social={
                <SocialCard
                  images={report.featuredImages}
                  pageUrl={report.url}
                />
              }
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
            <LinksTab
              pageKey={reportId}
              links={report.links}
              linkFilter={linkFilter}
              hideDuplicates={hideDuplicates}
              onHideDuplicates={setHideDuplicates}
              choices={choices}
              onChoose={choose}
              onIncludeAll={includeAll}
              chromeConnected={chromeConnected}
            />
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
                pageKey={reportId}
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
