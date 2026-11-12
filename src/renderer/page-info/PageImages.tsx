import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { canOpen } from '../../shared/link-rules';
import type { LinkFilter } from '../../shared/link-rules';
import { MAX_OPEN_LINKS } from '../../shared/types';
import { PieIcon } from '../components/icons/SliceIcon';
import { ChromeImage } from './ChromeImage';
import { InfoEmpty } from './InfoCard';
import { pageInfoBridge } from './page-info-bridge';
import { shareImageSource } from './page-info-view';
import { filterImages, imagesWord } from './page-images';
import { ASK_ABOVE } from './page-links';

const COPIED_MS = 1500;

const tabsWord = (count: number) => `${count} tab${count === 1 ? '' : 's'}`;

interface ImageRowProps {
  url: string;
  pageUrl: string;
  broken: boolean;
  copied: boolean;
  canOpenIt: boolean;
  chromeConnected: boolean;
  // Take the address, so they stay the same for every row: a memoized row
  // only redraws when its own image changes.
  onBroken: (url: string) => void;
  onEnlarge: (url: string) => void;
  onCopy: (url: string) => void;
  onOpen: (url: string) => void;
}

const ImageRow = memo(function ImageRow({
  url,
  pageUrl,
  broken,
  copied,
  canOpenIt,
  chromeConnected,
  onBroken,
  onEnlarge,
  onCopy,
  onOpen,
}: ImageRowProps) {
  // The address comes from the website, so only web images are loaded.
  const source = shareImageSource(url, pageUrl);
  const showThumb = source !== null && !broken;

  useEffect(() => {
    if (source === null) {
      onBroken(url);
    }
  }, [source, onBroken, url]);

  return (
    <li className="link-row image-row">
      <div className="image-thumb">
        {showThumb ? (
          <button
            type="button"
            className="image-thumb-open"
            aria-label="Show this image full size"
            title="Click to enlarge"
            onClick={() => onEnlarge(url)}
          >
            {/* Asked of Chrome only once the row scrolls into view. */}
            <ChromeImage
              url={source}
              size="thumb"
              alt=""
              lazy
              onBroken={() => onBroken(url)}
              offline={<span className="is-waiting" />}
            />
          </button>
        ) : (
          <PieIcon type="close" size={16} />
        )}
      </div>
      <div className="link-body">
        <p className="link-href">{url}</p>
        {broken && (
          <p className="link-status is-warning">
            Broken: the image did not load.
          </p>
        )}
        <div className="link-actions">
          <button
            type="button"
            className="link-button"
            title="Copy the address"
            onClick={() => onCopy(url)}
          >
            {copied ? 'Copied' : 'Copy URL'}
          </button>
          {canOpenIt && (
            <button
              type="button"
              className="link-button"
              disabled={!chromeConnected}
              title="Open in a background tab in Chrome"
              onClick={() => onOpen(url)}
            >
              Open
            </button>
          )}
        </div>
      </div>
    </li>
  );
});

interface ImageViewerProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  urls: string[];
  // The image shown, or null while closed.
  url: string | null;
  pageUrl: string;
  broken: boolean;
  onBroken: () => void;
  onMove: (url: string) => void;
  onClosed: () => void;
}

// The big view, with previous and next through the images listed.
function ImageViewer({
  dialogRef,
  urls,
  url,
  pageUrl,
  broken,
  onBroken,
  onMove,
  onClosed,
}: ImageViewerProps) {
  const index = url === null ? -1 : urls.indexOf(url);
  const previous = index > 0 ? urls[index - 1] : null;
  const next = index >= 0 && index < urls.length - 1 ? urls[index + 1] : null;
  const source = url === null ? null : shareImageSource(url, pageUrl);

  const onKey = (event: KeyboardEvent<HTMLDialogElement>) => {
    const target =
      event.key === 'ArrowLeft'
        ? previous
        : event.key === 'ArrowRight'
          ? next
          : null;
    if (target !== null) {
      event.preventDefault();
      onMove(target);
    }
  };

  // The arrows move; a click anywhere else, or Escape, closes the view.
  const arrow = (target: string | null, label: string, className: string) => (
    <button
      type="button"
      className={`image-viewer-arrow ${className}`}
      aria-label={label}
      title={label}
      disabled={target === null}
      onClick={(event) => {
        event.stopPropagation();
        if (target !== null) {
          onMove(target);
        }
      }}
    >
      <PieIcon type="chevron" size={28} />
    </button>
  );

  return (
    <dialog
      ref={dialogRef}
      className="image-viewer"
      aria-label={url ?? 'Image'}
      onClick={() => dialogRef.current?.close()}
      onClose={onClosed}
      onKeyDown={onKey}
    >
      {url !== null && (
        <>
          {source !== null && !broken ? (
            // The full image is fetched only now, when it is shown.
            <ChromeImage
              key={url}
              url={source}
              size="full"
              alt=""
              onBroken={onBroken}
              offline={
                <p className="image-viewer-broken">
                  Connect Chrome to see images.
                </p>
              }
            />
          ) : (
            <p className="image-viewer-broken">Could not load this image.</p>
          )}
          {arrow(previous, 'Previous image', 'is-previous')}
          {arrow(next, 'Next image', 'is-next')}
          {index >= 0 && (
            <p className="image-viewer-count">
              {index + 1} / {urls.length}
            </p>
          )}
        </>
      )}
    </dialog>
  );
}

export const PageImages = memo(function PageImages({
  pageKey,
  images,
  pageUrl,
  linkFilter,
  chromeConnected,
}: {
  // Changes with each new page; see PageInfoUpdate.reportId.
  pageKey: number;
  images: string[];
  pageUrl: string;
  linkFilter: LinkFilter;
  chromeConnected: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [opened, setOpened] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDialogElement>(null);

  // A new page starts fresh.
  useEffect(() => {
    setBroken(new Set());
    setConfirming(false);
    setOpened(0);
    viewerRef.current?.close();
  }, [pageKey]);

  useEffect(() => {
    if (copied === null) {
      return;
    }
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const shown = useMemo(() => filterImages(images, filter), [images, filter]);

  const markBroken = useCallback(
    (url: string) =>
      setBroken((current) =>
        current.has(url) ? current : new Set(current).add(url),
      ),
    [],
  );

  const copy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
    } catch {
      // The window lost focus mid-copy. Nothing to show.
    }
  }, []);
  const copyImage = useCallback((url: string) => void copy(url), [copy]);

  const enlarge = useCallback((url: string) => {
    setViewing(url);
    viewerRef.current?.showModal();
  }, []);

  const openOne = useCallback(
    (url: string) => void pageInfoBridge.openLinks([url]),
    [],
  );

  if (images.length === 0) {
    return <InfoEmpty>This page has no images.</InfoEmpty>;
  }

  const filtering = filter.trim() !== '';
  const brokenCount = images.filter((url) => broken.has(url)).length;
  const allOpenable = shown.filter((url) => canOpen(url, linkFilter));
  const toOpen = allOpenable.slice(0, MAX_OPEN_LINKS);

  const changeFilter = (value: string) => {
    setFilter(value);
    setConfirming(false);
    setOpened(0);
  };

  const openAll = async () => {
    const result = await pageInfoBridge.openLinks(toOpen);
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
          placeholder="Show only images whose address contains…"
          aria-label="Filter images by address"
          onChange={(event) => changeFilter(event.target.value)}
        />
      </div>

      <div className="link-summary">
        <p>
          {filtering ? (
            <>
              <strong>{shown.length}</strong> of {imagesWord(images.length)}{' '}
              match
            </>
          ) : (
            <strong>{imagesWord(images.length)}</strong>
          )}
          {brokenCount > 0 && ` (${brokenCount} broken)`}
        </p>
        {toOpen.length > 0 && !confirming && (
          <button
            type="button"
            className="link-button"
            disabled={!chromeConnected}
            title={
              filtering
                ? 'Open the matching images in background tabs in Chrome'
                : 'Open every image in background tabs in Chrome'
            }
            onClick={() =>
              toOpen.length > ASK_ABOVE ? setConfirming(true) : void openAll()
            }
          >
            Open all ({toOpen.length})
          </button>
        )}
      </div>

      {!chromeConnected && (
        <p className="info-note">
          Connect Chrome to see images. Page Info gets them through Chrome.
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
        <InfoEmpty>No image address contains "{filter.trim()}".</InfoEmpty>
      ) : (
        <ul className="link-list">
          {shown.map((url) => (
            <ImageRow
              key={url}
              url={url}
              pageUrl={pageUrl}
              broken={broken.has(url)}
              copied={copied === url}
              canOpenIt={canOpen(url, linkFilter)}
              chromeConnected={chromeConnected}
              onBroken={markBroken}
              onEnlarge={enlarge}
              onCopy={copyImage}
              onOpen={openOne}
            />
          ))}
        </ul>
      )}

      <ImageViewer
        dialogRef={viewerRef}
        urls={shown}
        url={viewing}
        pageUrl={pageUrl}
        broken={viewing !== null && broken.has(viewing)}
        onBroken={() => viewing !== null && markBroken(viewing)}
        onMove={setViewing}
        onClosed={() => setViewing(null)}
      />
    </div>
  );
});
