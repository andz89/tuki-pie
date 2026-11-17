import { memo, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { create } from 'zustand';
import { PieIcon, SliceIcon } from '../components/icons/SliceIcon';
import {
  MAX_HISTORY_DAYS,
  MAX_HISTORY_TEXT,
} from '../../shared/schemas/history.schema';
import type {
  HistoryMatch,
  HistoryVisit,
} from '../../shared/schemas/history.schema';
import { pageInfoBridge } from './page-info-bridge';
import { usePageInfoStore } from './page-info.store';

// Made once: a formatter costs far more than a format.
const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});
const CLOCK = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

// "14 Nov 10:42"
export function visitTime(time: number): string {
  const date = new Date(time);
  return `${DAY.format(date)} ${CLOCK.format(date)}`;
}

// The number box as whole days from 1 to the most allowed, or null.
export function readDays(typed: string): number | null {
  const days = Number(typed);
  return typed.trim() !== '' &&
    Number.isInteger(days) &&
    days >= 1 &&
    days <= MAX_HISTORY_DAYS
    ? days
    : null;
}

type Found =
  | { state: 'idle' }
  | { state: 'searching' }
  | { state: 'done'; visits: HistoryVisit[] }
  | { state: 'failed'; error: string };

// Kept outside the components, which each site tab draws afresh, so the last
// search is still there after opening a page from it.
interface HistorySearch {
  isOpen: boolean;
  typedDays: string;
  text: string;
  match: HistoryMatch;
  found: Found;
  // Addresses ticked to open together.
  ticked: ReadonlySet<string>;
  // The address last put on the clipboard, so its row says so.
  copied: string | null;
}

export const useHistorySearch = create<HistorySearch>()(() => ({
  isOpen: false,
  typedDays: '1',
  text: '',
  match: 'exact',
  found: { state: 'idle' },
  ticked: new Set(),
  copied: null,
}));

const update = (change: Partial<HistorySearch>) =>
  useHistorySearch.setState(change);

// The actions below live outside the components, so every row gets the same
// functions each time and only a row whose own flags changed is redrawn.

const toggleTicked = (url: string) =>
  useHistorySearch.setState(({ ticked }) => {
    const next = new Set(ticked);
    if (!next.delete(url)) {
      next.add(url);
    }
    return { ticked: next };
  });

// Ticks every page found, or unticks them all when all are ticked.
const toggleAll = () =>
  useHistorySearch.setState(({ found, ticked }) => {
    if (found.state !== 'done') {
      return {};
    }
    const allTicked =
      found.visits.length > 0 && ticked.size === found.visits.length;
    return {
      ticked: allTicked
        ? new Set<string>()
        : new Set(found.visits.map(({ url }) => url)),
    };
  });

// A tick box that shows a dash when only some are ticked.
function SelectAll({ some, all }: { some: boolean; all: boolean }) {
  const boxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.indeterminate = some && !all;
    }
  }, [some, all]);
  return (
    <label className="history-select-all">
      <input
        ref={boxRef}
        type="checkbox"
        className="history-tick"
        checked={all}
        onChange={toggleAll}
      />
      Select all
    </label>
  );
}

const openOne = (url: string) => {
  update({ isOpen: false });
  void usePageInfoStore.getState().newTab(url);
};

// Each ticked page in its own Page Info tab, in list order.
async function openTicked() {
  const { found, ticked } = useHistorySearch.getState();
  if (found.state !== 'done') {
    return;
  }
  const urls = found.visits
    .map(({ url }) => url)
    .filter((url) => ticked.has(url));
  update({ isOpen: false, ticked: new Set() });
  const { newTab } = usePageInfoStore.getState();
  for (const url of urls) {
    await newTab(url);
  }
}

const copy = (url: string) => {
  void navigator.clipboard
    .writeText(url)
    .then(() => update({ copied: url }))
    .catch(() => undefined);
};

async function search(event: FormEvent) {
  event.preventDefault();
  const { typedDays, text, match, found } = useHistorySearch.getState();
  const days = readDays(typedDays);
  if (days === null || found.state === 'searching') {
    return;
  }
  update({ found: { state: 'searching' }, ticked: new Set(), copied: null });
  const result = await pageInfoBridge.history(text.trim(), days, match);
  update({
    found: result.ok
      ? { state: 'done', visits: result.value }
      : { state: 'failed', error: result.error },
  });
}

// The History icon in the address row.
export function HistoryButton() {
  const chromeConnected = usePageInfoStore(
    (state) => state.update.chromeConnected,
  );
  return (
    <button
      type="button"
      className="button button-icon"
      disabled={!chromeConnected}
      aria-label="Chrome history"
      title={chromeConnected ? 'Chrome history' : 'Chrome not connected'}
      onClick={() => update({ isOpen: true })}
    >
      <SliceIcon type="history" x={0} y={0} />
    </button>
  );
}

// The days, the text and the match. Its own component, so typing redraws
// this row and not the list below.
function HistoryFilters() {
  const typedDays = useHistorySearch((state) => state.typedDays);
  const text = useHistorySearch((state) => state.text);
  const match = useHistorySearch((state) => state.match);
  const isSearching = useHistorySearch(
    (state) => state.found.state === 'searching',
  );
  const days = readDays(typedDays);

  return (
    <form className="history-filters" onSubmit={(event) => void search(event)}>
      <label className="history-days">
        Last
        <input
          type="number"
          min={1}
          max={MAX_HISTORY_DAYS}
          step={1}
          value={typedDays}
          aria-label="Days"
          aria-invalid={days === null}
          onChange={(event) => update({ typedDays: event.target.value })}
        />
        {days === 1 ? 'day' : 'days'}
      </label>
      <input
        type="search"
        className="history-text"
        placeholder={
          match === 'exact' ? 'https://flowsummit.com/register' : 'flowsummit'
        }
        aria-label="Address"
        maxLength={MAX_HISTORY_TEXT}
        value={text}
        onChange={(event) => update({ text: event.target.value })}
      />
      <button
        type="submit"
        className="button button-primary"
        disabled={days === null || isSearching}
      >
        {isSearching ? 'Searching...' : 'Search'}
      </button>
      <label className="history-exact">
        <input
          type="checkbox"
          checked={match === 'exact'}
          onChange={(event) =>
            update({ match: event.target.checked ? 'exact' : 'contains' })
          }
        />
        Match entire address
      </label>
    </form>
  );
}

// One visited page. Redrawn only when its own tick or Copied flag changes.
const HistoryRow = memo(function HistoryRow({
  visit,
  isTicked,
  isCopied,
}: {
  visit: HistoryVisit;
  isTicked: boolean;
  isCopied: boolean;
}) {
  return (
    <li>
      <input
        type="checkbox"
        className="history-tick"
        aria-label={`Select ${visit.url}`}
        checked={isTicked}
        onChange={() => toggleTicked(visit.url)}
      />
      <button
        type="button"
        className="history-open"
        title="Open in a new Page Info tab"
        onClick={() => openOne(visit.url)}
      >
        <span className="history-title">{visit.title || visit.url}</span>
        <span className="history-url">{visit.url}</span>
      </button>
      <span className="history-time">{visitTime(visit.lastVisit)}</span>
      <button
        type="button"
        className="button button-quiet"
        onClick={() => copy(visit.url)}
      >
        {isCopied ? 'Copied' : 'Copy'}
      </button>
    </li>
  );
});

function HistoryResults() {
  const found = useHistorySearch((state) => state.found);
  const ticked = useHistorySearch((state) => state.ticked);
  const copied = useHistorySearch((state) => state.copied);

  if (found.state === 'failed') {
    return (
      <p className="history-note" role="alert">
        {found.error}
      </p>
    );
  }
  if (found.state !== 'done') {
    return null;
  }
  if (found.visits.length === 0) {
    return <p className="history-note">No pages found.</p>;
  }
  return (
    <>
      <ul className="history-list">
        {found.visits.map((visit) => (
          <HistoryRow
            key={visit.url}
            visit={visit}
            isTicked={ticked.has(visit.url)}
            isCopied={copied === visit.url}
          />
        ))}
      </ul>
      <div className="history-foot">
        <SelectAll
          some={ticked.size > 0}
          all={ticked.size === found.visits.length}
        />
        <p className="history-note history-count" role="status">
          {found.visits.length === 1
            ? '1 page'
            : `${found.visits.length} pages`}
        </p>
        <button
          type="button"
          className="button button-primary"
          disabled={ticked.size === 0}
          title="Open each ticked page in a new Page Info tab"
          onClick={() => void openTicked()}
        >
          {ticked.size === 0
            ? 'Open selected'
            : `Open selected (${ticked.size})`}
        </button>
      </div>
    </>
  );
}

// Pages visited in Chrome, loaded only when you press Search. Drawn inside
// the Page Info root, so it has its colours, and outside the address row,
// which is a form itself.
export function HistoryDialog() {
  const isOpen = useHistorySearch((state) => state.isOpen);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The store says whether it is open; the dialog follows. Opening puts the
  // text box in focus: the dialog is hidden until shown, so React's own
  // autoFocus would have run too early.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (isOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('.history-text')?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Taken down while open (the window showing another view): it must not
  // spring up again by itself when it comes back.
  useEffect(
    () => () => {
      if (useHistorySearch.getState().isOpen) {
        update({ isOpen: false });
      }
    },
    [],
  );

  return (
    <dialog
      ref={dialogRef}
      className="history-dialog"
      aria-label="Chrome history"
      // Escape closes it natively; the store hears of it here.
      onClose={() => update({ isOpen: false, copied: null })}
    >
      {isOpen && (
        <>
          <div className="history-head">
            <h2>Chrome history</h2>
            <button
              type="button"
              className="button button-icon"
              aria-label="Close"
              title="Close"
              onClick={() => update({ isOpen: false })}
            >
              <PieIcon type="close" size={16} />
            </button>
          </div>
          <HistoryFilters />
          <HistoryResults />
        </>
      )}
    </dialog>
  );
}
