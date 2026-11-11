import { useEffect, useState } from 'react';
import { isMarked } from '../../shared/link-rules';
import type { LinkFilter } from '../../shared/link-rules';
import { MAX_OPEN_LINKS } from '../../shared/types';
import type { LinkSpot } from '../../shared/types';
import { PieIcon } from '../components/icons/SliceIcon';
import { InfoEmpty } from './InfoCard';
import { pageInfoBridge } from './page-info-bridge';
import {
  ASK_ABOVE,
  countAddresses,
  countMarked,
  filterLinks,
  includedLinks,
  isIncluded,
  isWebLink,
  openableUrls,
  shownLinks,
  uniqueLinks,
} from './page-links';
import type { LinkChoices, NumberedLink, PageLink } from './page-links';

const COPIED_MS = 1500;

// `unreachable` is the app's own: Chrome didn't answer.
type LinkStatus = LinkSpot | 'unreachable';

const STATUS_MESSAGES: Record<LinkStatus, { tone: string; text: string }> = {
  shown: {
    tone: 'is-good',
    text: 'Shown in Chrome. Click the page or press Esc there to remove the marker.',
  },
  hidden: {
    tone: 'is-warning',
    text: "This link is hidden on the page, so it can't be shown.",
  },
  'not-found': {
    tone: 'is-warning',
    text: 'This link is no longer on the page.',
  },
  unreachable: {
    tone: 'is-warning',
    text: "Couldn't reach the Chrome tab. Check the page again.",
  },
};

const HIDDEN_HINT =
  'Hidden on the page (closed menu, tab or popup). Open it on the page, then try Show on page.';

const TOKEN_HINT =
  'Carries a token or an ID, so it may do something when opened. Unticked to start: tick it to count and open it.';

const tabsWord = (count: number) => `${count} tab${count === 1 ? '' : 's'}`;

interface LinkRowProps {
  link: NumberedLink;
  marked: boolean;
  included: boolean;
  status: LinkStatus | undefined;
  copied: boolean;
  chromeConnected: boolean;
  onShow: () => void;
  onCopy: () => void;
  onOpen: () => void;
  onToggle: () => void;
}

function LinkRow({
  link,
  marked,
  included,
  status,
  copied,
  chromeConnected,
  onShow,
  onCopy,
  onOpen,
  onToggle,
}: LinkRowProps) {
  const message = status ? STATUS_MESSAGES[status] : null;
  return (
    <li className={included ? 'link-row' : 'link-row is-left-out'}>
      <input
        type="checkbox"
        className="link-include"
        checked={included}
        aria-label={`Count link ${link.index + 1} and include it in Open all`}
        title={
          included
            ? 'Untick to leave this link out of Open all and the counts'
            : 'Tick to count this link and include it in Open all'
        }
        onChange={onToggle}
      />
      <span className="link-number">{link.index + 1}</span>
      <div className="link-body">
        <p className="link-href">{link.href}</p>
        {message && (
          <p className={`link-status ${message.tone}`}>{message.text}</p>
        )}
        {marked && <p className="link-status is-warning">{TOKEN_HINT}</p>}
        {link.hidden && !status && <p className="link-hint">{HIDDEN_HINT}</p>}
        <div className="link-actions">
          <button
            type="button"
            className={
              status === 'shown' ? 'link-button button-on' : 'link-button'
            }
            disabled={!chromeConnected}
            title="Scroll to this link in Chrome and outline it"
            onClick={onShow}
          >
            Show on page
          </button>
          <button
            type="button"
            className="link-button"
            title="Copy the address"
            onClick={onCopy}
          >
            {copied ? 'Copied' : 'Copy URL'}
          </button>
          {isWebLink(link.href) && (!marked || included) && (
            <button
              type="button"
              className="link-button"
              disabled={!chromeConnected}
              title="Open in a background tab in Chrome"
              onClick={onOpen}
            >
              Open
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function PageLinks({
  pageKey,
  links,
  linkFilter,
  hideDuplicates,
  choices,
  onChoose,
  onIncludeAll,
  chromeConnected,
}: {
  // Changes with each new page; see PageInfoUpdate.reportId.
  pageKey: number;
  links: PageLink[];
  linkFilter: LinkFilter;
  hideDuplicates: boolean;
  // Which addresses count and go into "Open all".
  choices: LinkChoices;
  onChoose: (href: string, included: boolean) => void;
  onIncludeAll: () => void;
  chromeConnected: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [statuses, setStatuses] = useState<Record<number, LinkStatus>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [opened, setOpened] = useState(0);

  // A new page starts fresh.
  useEffect(() => {
    setStatuses({});
    setConfirming(false);
    setOpened(0);
  }, [pageKey]);

  useEffect(() => {
    if (copied === null) {
      return;
    }
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  if (links.length === 0) {
    return <InfoEmpty>This page has no links.</InfoEmpty>;
  }

  const visible = shownLinks(links, linkFilter);
  const hiddenByFilters = links.length - visible.length;
  if (visible.length === 0) {
    return (
      <InfoEmpty>
        All {links.length} links are hidden by Link filters. Open Link filters
        above to show them.
      </InfoEmpty>
    );
  }

  const listed = hideDuplicates ? uniqueLinks(visible) : visible;
  const duplicates = visible.length - listed.length;
  const filtering = filter.trim() !== '';
  const shown = filterLinks(listed, filter);
  // Counts and Open all skip what the user left out.
  const visibleIn = includedLinks(visible, choices, linkFilter);
  const listedIn = includedLinks(listed, choices, linkFilter);
  const shownIn = includedLinks(shown, choices, linkFilter);
  // Plain links the user unticked; marked links have their own note.
  const leftOutCount = countAddresses(
    visible.filter(
      ({ href }) => choices.get(href) === false && !isMarked(href, linkFilter),
    ),
  );
  const allOpenable = openableUrls(shownIn);
  const toOpen = allOpenable.slice(0, MAX_OPEN_LINKS);
  // Marked links still unticked.
  const marked = countMarked(
    shown.filter(({ href }) => !isIncluded(href, choices, linkFilter)),
    linkFilter,
  );
  const tickedMarked = (urls: string[]) =>
    urls.filter((href) => isMarked(href, linkFilter));

  const changeFilter = (value: string) => {
    setFilter(value);
    setConfirming(false);
    setOpened(0);
  };

  // The page marks one link at a time, so a new mark replaces the old one.
  const setStatus = (index: number, status: LinkStatus) =>
    setStatuses((current) => {
      const next: Record<number, LinkStatus> = {};
      for (const [key, value] of Object.entries(current)) {
        if (!(status === 'shown' && value === 'shown')) {
          next[Number(key)] = value;
        }
      }
      next[index] = status;
      return next;
    });

  const show = async ({ index, href }: NumberedLink) => {
    const result = await pageInfoBridge.showLink(index, href);
    setStatus(index, result.ok && result.value ? result.value : 'unreachable');
  };

  const copy = async ({ index, href }: NumberedLink) => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(index);
    } catch {
      // The window lost focus mid-copy. Nothing to show.
    }
  };

  const openAll = async () => {
    const result = await pageInfoBridge.openLinks(toOpen, tickedMarked(toOpen));
    setConfirming(false);
    setOpened(result.ok && result.value ? toOpen.length : 0);
  };

  return (
    <div className="page-links">
      <div className="link-filter">
        <span className="link-filter-icon">
          <PieIcon type="search" size={14} />
        </span>
        <input
          type="search"
          value={filter}
          placeholder="Show only links whose address contains…"
          aria-label="Filter links by address"
          onChange={(event) => changeFilter(event.target.value)}
        />
      </div>

      <div className="link-summary">
        <p>
          {filtering ? (
            <>
              <strong>{shownIn.length}</strong> of {listedIn.length} links match
            </>
          ) : hideDuplicates ? (
            <>
              <strong>{listedIn.length}</strong> different links
              {duplicates > 0 &&
                ` (${duplicates} duplicate${duplicates === 1 ? '' : 's'} hidden)`}
            </>
          ) : (
            <>
              <strong>{visibleIn.length}</strong> links (
              {countAddresses(visibleIn)} different addresses)
            </>
          )}
        </p>
        {toOpen.length > 0 && !confirming && (
          <button
            type="button"
            className="link-button"
            disabled={!chromeConnected}
            title={
              filtering
                ? 'Open the matching links in background tabs in Chrome'
                : 'Open every link in background tabs in Chrome'
            }
            onClick={() =>
              toOpen.length > ASK_ABOVE ? setConfirming(true) : void openAll()
            }
          >
            Open all ({toOpen.length})
          </button>
        )}
      </div>

      {leftOutCount > 0 && (
        <p className="info-note link-left-out-note">
          {leftOutCount} left out of Open all and the counts.
          <button type="button" className="link-button" onClick={onIncludeAll}>
            Include all
          </button>
        </p>
      )}
      {hiddenByFilters > 0 && (
        <p className="info-note">{hiddenByFilters} hidden by Link filters.</p>
      )}
      {marked > 0 && (
        <p className="info-note">
          {marked} link{marked === 1 ? '' : 's'} that carry a token or an ID{' '}
          {marked === 1 ? 'is' : 'are'} unticked. Tick one to count and open it.
        </p>
      )}

      {confirming && (
        <div className="link-confirm">
          <p>
            Open {tabsWord(toOpen.length)} at once?
            {allOpenable.length > toOpen.length &&
              ` Only the first ${MAX_OPEN_LINKS} of ${allOpenable.length} open.`}
          </p>
          <div className="link-actions">
            <button
              type="button"
              className="link-button button-on"
              onClick={() => void openAll()}
            >
              Open {tabsWord(toOpen.length)}
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {opened > 0 && !confirming && (
        <p className="info-note">
          Opened {tabsWord(opened)} in the background.
        </p>
      )}

      {shown.length === 0 ? (
        <InfoEmpty>No link address contains "{filter.trim()}".</InfoEmpty>
      ) : (
        <ol className="link-list">
          {shown.map((link) => (
            <LinkRow
              key={link.index}
              link={link}
              marked={isMarked(link.href, linkFilter)}
              included={isIncluded(link.href, choices, linkFilter)}
              status={statuses[link.index]}
              copied={copied === link.index}
              chromeConnected={chromeConnected}
              onShow={() => void show(link)}
              onCopy={() => void copy(link)}
              onOpen={() =>
                void pageInfoBridge.openLinks(
                  [link.href],
                  tickedMarked([link.href]),
                )
              }
              onToggle={() =>
                onChoose(link.href, !isIncluded(link.href, choices, linkFilter))
              }
            />
          ))}
        </ol>
      )}
    </div>
  );
}
