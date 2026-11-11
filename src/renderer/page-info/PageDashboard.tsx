import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TITLE_MAX,
} from '../../shared/page-audit';
import type { PageReport } from '../../shared/types';
import {
  canonicalState,
  headingCounts,
  hostOf,
  lengthState,
  linkBreakdown,
  outline,
} from './page-dashboard';
import type { LengthState } from './page-dashboard';
import type { PageLink } from './page-links';
import { shareImageSource } from './page-info-view';
import { usePageInfoStore } from './page-info.store';
import { useCountUp } from './use-count-up';

export type PageInfoTab =
  | 'dashboard'
  | 'info'
  | 'links'
  | 'images'
  | 'screenshot';

type OpenTab = (tab: PageInfoTab) => void;

const ISSUES_SHOWN = 4;
const HEADINGS_SHOWN = 6;
const THUMBS_SHOWN = 7;

// Each tile rises in a little after the one before it.
const order = (index: number) => ({ '--i': index }) as CSSProperties;

function Tile({
  title,
  index,
  wide,
  action,
  children,
}: {
  title: string;
  index: number;
  wide?: boolean;
  action?: { label: string; open: () => void };
  children: ReactNode;
}) {
  return (
    <section
      className={wide ? 'dash-tile is-wide' : 'dash-tile'}
      aria-label={title}
      style={order(index)}
    >
      <header className="dash-tile-head">
        <h2>{title}</h2>
        {action && (
          <button type="button" className="dash-more" onClick={action.open}>
            {action.label}
            <span aria-hidden="true"> ›</span>
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

function Stat({
  value,
  label,
  tone,
  open,
}: {
  value: number;
  label: string;
  tone?: 'bad' | 'warn';
  open: () => void;
}) {
  const shown = useCountUp(value);
  const toneClass = tone && value > 0 ? ` is-${tone}` : '';
  return (
    <button type="button" className={`dash-stat${toneClass}`} onClick={open}>
      <span className="dash-stat-value">{shown.toLocaleString()}</span>
      <span className="dash-stat-label">{label}</span>
    </button>
  );
}

const LENGTH_NOTE: Record<LengthState, string> = {
  missing: 'missing',
  short: 'short',
  ok: '',
  long: 'too long',
};

function LengthBar({
  label,
  length,
  min,
  max,
}: {
  label: string;
  length: number;
  min: number;
  max: number;
}) {
  const state = lengthState(length, min, max);
  const fill = Math.min(100, (length / max) * 100);
  return (
    <div className={`dash-length is-${state}`}>
      <div className="dash-length-row">
        <span className="dash-sub">{label}</span>
        <span className="dash-length-count">
          {length} / {max}
          {LENGTH_NOTE[state] && ` · ${LENGTH_NOTE[state]}`}
        </span>
      </div>
      <div className="dash-meter" aria-hidden="true">
        <div className="dash-meter-fill" style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function Thumb({ url, pageUrl }: { url: string; pageUrl: string }) {
  const [broken, setBroken] = useState(false);
  const source = shareImageSource(url, pageUrl);
  if (source === null || broken) {
    return <div className="dash-thumb is-broken" aria-hidden="true" />;
  }
  return (
    <img
      className="dash-thumb"
      src={source}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

function SiteTile({ report }: { report: PageReport }) {
  const { url, meta, seo } = report;
  const host = hostOf(url);
  const canonical = {
    none: 'Canonical: none',
    same: 'Canonical: same page',
    other: 'Canonical: other page',
  }[canonicalState(url, meta.canonical)];
  const robots = seo.robots.map(({ content }) => content).join(', ');
  return (
    <section
      className="dash-tile dash-site is-wide"
      aria-label="Site"
      style={order(0)}
    >
      <div className="dash-badge" aria-hidden="true">
        {host.charAt(0).toUpperCase()}
      </div>
      <div className="dash-site-text">
        <h1>{meta.title || 'No title'}</h1>
        <p className="dash-url">{url}</p>
        <div className="dash-chips">
          <span className="dash-chip">Language: {meta.lang || 'not set'}</span>
          <span className="dash-chip">{canonical}</span>
          <span className="dash-chip">Robots: {robots || 'not set'}</span>
        </div>
      </div>
    </section>
  );
}

function SocialTile({ report, index }: { report: PageReport; index: number }) {
  const { featuredImages, meta, url } = report;
  const image =
    featuredImages.find(({ property }) => property === 'og:image') ??
    featuredImages[0];
  const source = image ? shareImageSource(image.url, url) : null;
  const [broken, setBroken] = useState(false);
  return (
    <Tile title="Social preview" index={index}>
      <div className="dash-share">
        {source && !broken ? (
          <img
            className="dash-share-image"
            src={source}
            alt="Share image"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="dash-share-image is-empty">
            {image ? 'Could not load the share image' : 'No share image'}
          </div>
        )}
        <div className="dash-share-text">
          <span className="dash-share-host">{hostOf(url)}</span>
          <strong>{meta.title || 'No title'}</strong>
          {meta.description && (
            <span className="dash-sub">{meta.description}</span>
          )}
        </div>
      </div>
    </Tile>
  );
}

function ScreenshotTile({
  index,
  chromeConnected,
  open,
}: {
  index: number;
  chromeConnected: boolean;
  open: () => void;
}) {
  const { status, shot } = usePageInfoStore((state) => state.screenshot);
  const take = usePageInfoStore((state) => state.takeScreenshot);
  const taking = status === 'taking';
  return (
    <Tile title="Screenshot" index={index} action={{ label: 'Open', open }}>
      {shot ? (
        <button
          type="button"
          className="dash-shot"
          aria-label="Open the screenshot"
          onClick={open}
        >
          <img src={shot.dataUrl} alt="" />
        </button>
      ) : (
        <div className="dash-shot is-empty">
          <span className="dash-sub">
            {taking ? 'Taking the screenshot…' : 'No picture yet'}
          </span>
          <button
            type="button"
            className="link-button button-on"
            disabled={!chromeConnected || taking}
            onClick={() => void take()}
          >
            Take screenshot
          </button>
        </div>
      )}
    </Tile>
  );
}

export function PageDashboard({
  report,
  countedLinks,
  chromeConnected,
  onOpen,
}: {
  report: PageReport;
  // The links the Links tab counts: after filters, ticks and duplicates.
  countedLinks: PageLink[];
  chromeConnected: boolean;
  onOpen: OpenTab;
}) {
  const { issues, seo, tracking, images, hyvorTalk, url } = report;
  const errors = issues.filter(({ level }) => level === 'error').length;
  const warnings = issues.length - errors;
  const headings = headingCounts(seo);
  const firstHeadings = outline(seo.headings, HEADINGS_SHOWN);
  const links = linkBreakdown(countedLinks, url);
  const linkParts = [
    { label: 'Same site', count: links.sameSite, kind: 'same' },
    { label: 'Other sites', count: links.otherSites, kind: 'other' },
    { label: 'Other kinds', count: links.otherKinds, kind: 'kinds' },
  ];
  const hyvorIds = (hyvorTalk?.attributes ?? []).filter(({ name }) =>
    /website-id|page-id/.test(name),
  );
  const openInfo = () => onOpen('info');
  let tile = 3;

  return (
    <div className="dash">
      <SiteTile report={report} />

      <div className="dash-stats is-wide" style={order(1)}>
        <Stat value={errors} label="Errors" tone="bad" open={openInfo} />
        <Stat value={warnings} label="Warnings" tone="warn" open={openInfo} />
        <Stat
          value={tracking.trackers.length}
          label="Trackers"
          open={openInfo}
        />
        <Stat value={links.total} label="Links" open={() => onOpen('links')} />
        <Stat
          value={images.length}
          label="Images"
          open={() => onOpen('images')}
        />
      </div>

      <Tile
        title="Issues"
        index={2}
        wide
        action={
          issues.length > ISSUES_SHOWN
            ? { label: `See all ${issues.length}`, open: openInfo }
            : undefined
        }
      >
        {issues.length === 0 ? (
          <p className="dash-good">No issues found.</p>
        ) : (
          <ul className="dash-issues">
            {issues
              .slice(0, ISSUES_SHOWN)
              .map(({ level, area, message }, index) => (
                <li key={index} className={`is-${level}`}>
                  <span className="dash-level">{level}</span>
                  <span className="dash-sub dash-area">{area}</span>
                  <span>{message}</span>
                </li>
              ))}
          </ul>
        )}
      </Tile>

      <Tile
        title="SEO"
        index={tile++}
        action={{ label: 'Details', open: openInfo }}
      >
        <LengthBar
          label="Title"
          length={report.meta.title?.length ?? 0}
          min={1}
          max={TITLE_MAX}
        />
        <LengthBar
          label="Description"
          length={report.meta.description?.length ?? 0}
          min={DESCRIPTION_MIN}
          max={DESCRIPTION_MAX}
        />
        <div className="dash-mini">
          <div className={headings.h1 === 1 ? '' : 'is-bad'}>
            <strong>{headings.h1}</strong>
            <span>H1</span>
          </div>
          <div>
            <strong>{headings.total}</strong>
            <span>Headings</span>
          </div>
          <div>
            <strong>{seo.hreflang.total}</strong>
            <span>hreflang</span>
          </div>
        </div>
      </Tile>

      <Tile
        title="Tracking"
        index={tile++}
        action={{ label: 'Details', open: openInfo }}
      >
        {tracking.trackers.length === 0 ? (
          <p className="dash-sub">No trackers found.</p>
        ) : (
          <ul className="dash-rows">
            {tracking.trackers.map(({ name, ids, duplicateSrcs }) => {
              const repeats = Math.max(
                0,
                ...duplicateSrcs.map(({ count }) => count),
              );
              return (
                <li key={name}>
                  <span>{name}</span>
                  {repeats > 1 ? (
                    <span className="dash-warn">loaded {repeats} times</span>
                  ) : (
                    <code className="dash-sub">
                      {ids.join(', ') || 'no ID'}
                    </code>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="dash-chips">
          <span className="dash-chip">
            UTM links: {tracking.utm.taggedCount}
          </span>
          <span
            className={
              tracking.utm.problems.total ? 'dash-chip is-warn' : 'dash-chip'
            }
          >
            UTM problems: {tracking.utm.problems.total}
          </span>
          <span
            className={
              tracking.mixedContent.total ? 'dash-chip is-bad' : 'dash-chip'
            }
          >
            Mixed content: {tracking.mixedContent.total}
          </span>
          <span
            className={
              tracking.unsafeBlankLinks.total
                ? 'dash-chip is-warn'
                : 'dash-chip'
            }
          >
            Unsafe _blank: {tracking.unsafeBlankLinks.total}
          </span>
        </div>
      </Tile>

      <SocialTile report={report} index={tile++} />

      <Tile
        title="Heading outline"
        index={tile++}
        action={{ label: `All ${headings.total}`, open: openInfo }}
      >
        {firstHeadings.shown.length === 0 ? (
          <p className="dash-sub">No headings found.</p>
        ) : (
          <ol className="dash-outline">
            {firstHeadings.shown.map(({ level, text }, index) => (
              <li
                key={index}
                className={level === 1 && headings.h1 !== 1 ? 'is-bad' : ''}
                style={{ paddingLeft: `${(level - 1) * 14}px` }}
              >
                <span className="dash-h">H{level}</span>
                <span>{text || '(empty)'}</span>
              </li>
            ))}
          </ol>
        )}
        {firstHeadings.more > 0 && (
          <p className="dash-sub">+ {firstHeadings.more} more</p>
        )}
      </Tile>

      <Tile
        title="Links"
        index={tile++}
        action={{ label: 'Open list', open: () => onOpen('links') }}
      >
        {links.total === 0 ? (
          <p className="dash-sub">No links found.</p>
        ) : (
          <>
            <div className="dash-bar" aria-hidden="true">
              {linkParts.map(({ kind, count }) =>
                count > 0 ? (
                  <div
                    key={kind}
                    className={`dash-bar-part is-${kind}`}
                    style={{ flexGrow: count }}
                  />
                ) : null,
              )}
            </div>
            <ul className="dash-rows">
              {linkParts.map(({ label, count, kind }) => (
                <li key={kind}>
                  <span className="dash-key">
                    <span
                      className={`dash-dot is-${kind}`}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
            <p className="dash-sub">
              Hidden: {links.hidden} · Duplicates: {links.duplicates}
            </p>
          </>
        )}
      </Tile>

      <Tile
        title="Images"
        index={tile++}
        action={{ label: `All ${images.length}`, open: () => onOpen('images') }}
      >
        {images.length === 0 ? (
          <p className="dash-sub">No images found.</p>
        ) : (
          <div className="dash-thumbs">
            {images.slice(0, THUMBS_SHOWN).map((image, index) => (
              <Thumb key={`${index}|${image}`} url={image} pageUrl={url} />
            ))}
            {images.length > THUMBS_SHOWN && (
              <button
                type="button"
                className="dash-thumb is-more"
                onClick={() => onOpen('images')}
              >
                +{images.length - THUMBS_SHOWN}
              </button>
            )}
          </div>
        )}
      </Tile>

      <ScreenshotTile
        index={tile++}
        chromeConnected={chromeConnected}
        open={() => onOpen('screenshot')}
      />

      <Tile
        title="Comments"
        index={tile++}
        action={{ label: 'Details', open: openInfo }}
      >
        {hyvorTalk ? (
          <>
            <p className="dash-key">
              <span className="dash-dot is-good" aria-hidden="true" />
              Hyvor Talk found
            </p>
            <ul className="dash-rows">
              {hyvorIds.map(({ name, value }) => (
                <li key={name}>
                  <span className="dash-sub">{name}</span>
                  <code>{value}</code>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="dash-sub">No comment widget found.</p>
        )}
      </Tile>
    </div>
  );
}
