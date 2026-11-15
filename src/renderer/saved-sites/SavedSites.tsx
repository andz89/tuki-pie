import { useEffect, useMemo, useRef, useState } from 'react';
import type { SavedSite } from '../../shared/types';
import { ConfirmBar } from '../components/ConfirmBar';
import { PieIcon } from '../components/icons/SliceIcon';
import { InfoEmpty } from '../page-info/InfoCard';
import { PageInfoCards, SocialAddressCard } from '../page-info/PageInfoCards';
import { hostOf } from '../page-info/page-dashboard';
import { matchesSearch, useSavedSitesStore } from './saved-sites.store';
import { savedDate } from './saved-view';

// Waits this long after the last key before saving the note.
const NOTE_SAVE_MS = 500;

type DetailTab = 'info' | 'links' | 'images' | 'screenshot';

// One address per row, with Copy.
function AddressList({ addresses }: { addresses: string[] }) {
  const [copied, setCopied] = useState<number | null>(null);
  if (addresses.length === 0) {
    return <InfoEmpty>None found.</InfoEmpty>;
  }
  return (
    <ul className="saved-address-list">
      {addresses.map((address, index) => (
        <li key={`${index}|${address}`}>
          <span className="saved-address">{address}</span>
          <button
            type="button"
            className="button-quiet"
            onClick={() =>
              void navigator.clipboard
                .writeText(address)
                .then(() => setCopied(index))
                .catch(() => undefined)
            }
          >
            {copied === index ? 'Copied' : 'Copy'}
          </button>
        </li>
      ))}
    </ul>
  );
}

// The note saves as you type. Keyed by the site, so each starts from its own.
function NoteField({ site }: { site: SavedSite }) {
  const setNote = useSavedSitesStore((state) => state.setNote);
  const [text, setText] = useState(site.note);
  const pending = useRef<{ timer: number; text: string } | null>(null);

  // Typed in the last half second before leaving the site is still saved.
  useEffect(
    () => () => {
      if (pending.current) {
        clearTimeout(pending.current.timer);
        void setNote(site.id, pending.current.text);
      }
    },
    [site.id, setNote],
  );

  return (
    <label className="saved-note">
      <span>Note</span>
      <textarea
        value={text}
        placeholder="What to remember about this site"
        rows={3}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (pending.current) {
            clearTimeout(pending.current.timer);
          }
          pending.current = {
            text: next,
            timer: window.setTimeout(() => {
              pending.current = null;
              void setNote(site.id, next);
            }, NOTE_SAVE_MS),
          };
        }}
      />
    </label>
  );
}

function ScreenshotPanel() {
  const { status, url } = useSavedSitesStore((state) => state.screenshot);
  const load = useSavedSitesStore((state) => state.loadScreenshot);
  const save = useSavedSitesStore((state) => state.saveScreenshot);
  const copy = useSavedSitesStore((state) => state.copyScreenshot);
  useEffect(() => void load(), [load]);

  if (status === 'missing') {
    return (
      <p className="info-warning" role="alert">
        The screenshot file is missing. It was saved, but can no longer be read.
      </p>
    );
  }
  if (!url) {
    return <p role="status">Loading the screenshot…</p>;
  }
  return (
    <div className="saved-screenshot">
      <div className="saved-screenshot-buttons">
        <button type="button" className="button" onClick={() => void save()}>
          Save to Pictures
        </button>
        <button type="button" className="button" onClick={() => void copy()}>
          Copy
        </button>
      </div>
      <img src={url} alt="Saved screenshot of the page" />
    </div>
  );
}

function SiteDetail({
  site,
  onOpenedLive,
}: {
  site: SavedSite;
  onOpenedLive?: () => void;
}) {
  const remove = useSavedSitesStore((state) => state.remove);
  const openLive = useSavedSitesStore((state) => state.openLive);
  const [tab, setTab] = useState<DetailTab>('info');
  const [isDeleting, setIsDeleting] = useState(false);
  const { report } = site;

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'info', label: 'Page info' },
    { id: 'links', label: `Links (${report.links.length})` },
    { id: 'images', label: `Images (${report.images.length})` },
    ...(site.hasScreenshot
      ? [{ id: 'screenshot' as const, label: 'Screenshot' }]
      : []),
  ];

  return (
    <section className="saved-detail" aria-label={site.title}>
      <header className="saved-detail-head">
        <div className="saved-detail-title">
          <h1>{site.title}</h1>
          <p>
            {site.address} · saved {savedDate(site.savedAt, true)}
          </p>
        </div>
        <div className="saved-detail-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              void openLive(site.id).then((isOpen) => {
                if (isOpen) {
                  onOpenedLive?.();
                }
              })
            }
          >
            Open in Page Info
          </button>
          <button
            type="button"
            className="button"
            onClick={() => setIsDeleting(true)}
          >
            Delete
          </button>
        </div>
      </header>
      {isDeleting && (
        <ConfirmBar
          message={`Delete ${site.title}? Its saved results, screenshot and note go too.`}
          confirm="Delete"
          onConfirm={() => void remove(site.id)}
          onCancel={() => setIsDeleting(false)}
        />
      )}
      <NoteField key={site.id} site={site} />
      <div className="info-tabs" role="tablist" aria-label="Saved results">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'info-tab is-active' : 'info-tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="saved-panel">
        {tab === 'info' && (
          <PageInfoCards
            report={report}
            social={<SocialAddressCard images={report.featuredImages} />}
          />
        )}
        {tab === 'links' && (
          <AddressList addresses={report.links.map(({ href }) => href)} />
        )}
        {tab === 'images' && <AddressList addresses={report.images} />}
        {tab === 'screenshot' && <ScreenshotPanel />}
      </div>
    </section>
  );
}

// The saved sites, in their own window or in place of the Page Info tabs.
// onBack: shown in place of the tabs, with a way back to them.
export function SavedSites({ onBack }: { onBack?: () => void }) {
  const sites = useSavedSitesStore((state) => state.sites);
  const selected = useSavedSitesStore((state) => state.selected);
  const problem = useSavedSitesStore((state) => state.problem);
  const notice = useSavedSitesStore((state) => state.notice);
  const start = useSavedSitesStore((state) => state.start);
  const select = useSavedSitesStore((state) => state.select);
  const [search, setSearch] = useState('');

  useEffect(() => void start(), [start]);

  const shown = useMemo(
    () => sites.filter((site) => matchesSearch(site, search)),
    [sites, search],
  );

  return (
    <div className="saved-sites">
      <header className="saved-sites-bar">
        {onBack && (
          <button type="button" className="button-quiet" onClick={onBack}>
            <PieIcon type="back" size={14} /> Back to Page Info
          </button>
        )}
        <h2>Saved sites</h2>
        <div className="saved-search">
          <PieIcon type="search" size={14} />
          <input
            type="search"
            value={search}
            placeholder="Search saved sites"
            aria-label="Search saved sites"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </header>
      <div className="saved-sites-body">
        <ul className="saved-list" aria-label="Saved sites">
          {shown.map((site) => (
            <li key={site.id}>
              <button
                type="button"
                className={
                  selected?.id === site.id ? 'saved-item is-open' : 'saved-item'
                }
                onClick={() => void select(site.id)}
              >
                <span className="saved-item-title">{site.title}</span>
                <span className="saved-item-meta">
                  {hostOf(site.address)} · {savedDate(site.savedAt)}
                </span>
              </button>
            </li>
          ))}
          {sites.length === 0 && (
            <li className="saved-empty">
              Nothing saved yet. Use Save in Page Info to keep a site here.
            </li>
          )}
          {sites.length > 0 && shown.length === 0 && (
            <li className="saved-empty">No saved site matches.</li>
          )}
        </ul>
        <div className="saved-main">
          {problem && <p role="alert">{problem}</p>}
          {notice && <p role="status">{notice}</p>}
          {selected ? (
            <SiteDetail
              key={`${selected.id}:${selected.savedAt}`}
              site={selected}
              onOpenedLive={onBack}
            />
          ) : (
            <p className="saved-empty">Pick a saved site to see its details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
