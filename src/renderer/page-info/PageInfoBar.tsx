import { useEffect, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { PieIcon, SliceIcon } from '../components/icons/SliceIcon';
import { useHighlightSearch } from './highlight-search';
import { usePageInfoStore } from './page-info.store';

const MAX_ADDRESS_LENGTH = 2048;

// The address box and its buttons. What you type stays in here, so each
// keystroke redraws this row, not the lists below.
export function AddressBar() {
  const address = usePageInfoStore((state) => state.update.address);
  const chromeConnected = usePageInfoStore(
    (state) => state.update.chromeConnected,
  );
  const onTop = usePageInfoStore(
    (state) => state.settings.pageInfoOnTop === 'on-top',
  );
  const check = usePageInfoStore((state) => state.check);
  const refresh = usePageInfoStore((state) => state.refresh);
  const goToTab = usePageInfoStore((state) => state.goToTab);
  const toggleOnTop = usePageInfoStore((state) => state.toggleOnTop);
  const [typed, setTyped] = useState('');

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
    <form className="page-info-address-row" onSubmit={submit}>
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
    </form>
  );
}

// Marks words in the results below. Its own component for the same reason.
export function HighlightBox({
  resultsRef,
}: {
  resultsRef: RefObject<HTMLElement | null>;
}) {
  const [highlight, setHighlight] = useState('');
  const matchCount = useHighlightSearch(resultsRef, highlight);

  return (
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
  );
}
