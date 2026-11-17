import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import {
  INFO_CARD_FIELDS,
  type InfoCardField,
  type InfoCardLayout,
  type InfoCardView,
} from '../../shared/schemas/info-card.schema';
import type { InfoCardPage, InfoCardState } from '../../shared/types';
import { SliceIcon } from '../components/icons/SliceIcon';
import { ChromeImage } from '../page-info/ChromeImage';
import { ChromeImageSourceContext } from '../page-info/chrome-image-source';
import { shareImageSource } from '../page-info/page-info-view';
import { ImagesCard } from './ImagesCard';
import { LinksCard } from './LinksCard';
import { infoCardBridge } from './info-card-bridge';

export const FIELD_NAMES: Record<InfoCardField, string> = {
  title: 'Title, URL, description, language',
  canonical: 'Canonical',
  headings: 'Headings',
  counts: 'Counts',
  tracking: 'Tracking',
  hyvor: 'Hyvor Talk',
  images: 'Featured images',
};

const VIEW_NAMES: Record<InfoCardView, string> = {
  info: 'Info Card',
  links: 'Links',
  images: 'Images',
};

const LAYOUT_NAMES: Record<InfoCardLayout, string> = {
  sidebar: 'Sidebar',
  top: 'Top',
  bottom: 'Bottom',
};

const MAX_IMAGES = 3;

type Menu = 'layout' | 'fields' | null;
type Place = { top: number; right: number };

export function InfoCard() {
  const [state, setState] = useState<InfoCardState | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [place, setPlace] = useState<Place>({ top: 0, right: 0 });
  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    // The same page keeps the same object, so pinning, the theme or a
    // filter does not redraw every link and image row.
    const stop = infoCardBridge.onUpdate((next) =>
      setState((shown) =>
        shown?.page && next.page && shown.pageId === next.pageId
          ? { ...next, page: shown.page }
          : next,
      ),
    );
    void infoCardBridge.getState().then((result) => {
      if (result.ok) {
        setState((shown) => shown ?? result.value);
      }
    });
    return stop;
  }, []);

  const connected = state !== null && state.status !== 'not-connected';
  const imageSource = useMemo(
    () => ({ connected, fetch: infoCardBridge.image }),
    [connected],
  );

  if (!state) {
    return <div className="info-card" data-theme="dark" />;
  }

  // The menu card opens beside the button that opened it: below it in the
  // sidebar, to its left in the bars, where the buttons are on the right.
  // The Links or Images card, in the Info Card's place.
  const list = state.view !== 'info';

  const toggle = (next: Exclude<Menu, null>, button: HTMLElement) => {
    if (menu === next) {
      setMenu(null);
      return;
    }
    const card = button.closest('.info-card')!.getBoundingClientRect();
    const spot = button.getBoundingClientRect();
    setPlace(
      state.layout === 'sidebar'
        ? { top: spot.bottom - card.top + 4, right: card.right - spot.right }
        : { top: 4, right: card.right - spot.left + 4 },
    );
    setMenu(next);
  };

  return (
    <ChromeImageSourceContext.Provider value={imageSource}>
      <div
        className="info-card"
        // The Links card always sits down the right edge.
        data-layout={list ? 'sidebar' : state.layout}
        data-view={state.view}
        data-theme={state.theme}
      >
        <div className="info-card-tools">
          <span className="info-card-name">
            <span className="info-card-mark" aria-hidden="true" />
            {VIEW_NAMES[state.view]}
          </span>
          {state.status === 'reading' && state.page && (
            <span className="info-card-reading">Reading…</span>
          )}
          {list && (
            <ToolButton
              label="Back to Info Card"
              icon="info-card"
              onClick={() => void infoCardBridge.setView('info')}
            />
          )}
          <ToolButton
            label="Open in Web Page"
            icon="page-info"
            disabled={state.page === null}
            onClick={() => void infoCardBridge.openInWebPage()}
          />
          <ToolButton
            label={
              state.pinned ? 'Unpin: close when I click away' : 'Pin: keep open'
            }
            pressed={state.pinned}
            icon={state.pinned ? 'pin' : 'pin-off'}
            onClick={() => void infoCardBridge.setPinned(!state.pinned)}
          />
          {!list && (
            <>
              <ToolButton
                label="Layout"
                pressed={menu === 'layout'}
                icon="layout"
                onClick={(event) => toggle('layout', event.currentTarget)}
              />
              <ToolButton
                label="Choose what to show"
                pressed={menu === 'fields'}
                icon="fields"
                onClick={(event) => toggle('fields', event.currentTarget)}
              />
            </>
          )}
          <ToolButton
            label="Close"
            icon="close"
            onClick={() => void infoCardBridge.close()}
          />
        </div>
        <div className="info-card-body">
          {state.view === 'links' && state.page ? (
            <LinksCard state={state} />
          ) : state.view === 'images' && state.page ? (
            <ImagesCard state={state} />
          ) : (
            <CardContent state={state} />
          )}
        </div>
        {menu === 'layout' && (
          <MenuCard title="Layout" place={place} onClose={closeMenu}>
            <LayoutMenu
              layout={state.layout}
              onPick={(layout) => {
                setMenu(null);
                void infoCardBridge.setLayout(layout);
              }}
            />
          </MenuCard>
        )}
        {menu === 'fields' && (
          <MenuCard title="Show on the card" place={place} onClose={closeMenu}>
            <FieldsMenu
              fields={state.fields}
              onChange={(fields) => {
                // Shown at once, so a second quick tick builds on this one.
                setState((shown) => shown && { ...shown, fields });
                void infoCardBridge.setFields(fields);
              }}
            />
          </MenuCard>
        )}
      </div>
    </ChromeImageSourceContext.Provider>
  );
}

function ToolButton({
  label,
  icon,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  icon:
    | 'info-card'
    | 'page-info'
    | 'pin'
    | 'pin-off'
    | 'layout'
    | 'fields'
    | 'close';
  pressed?: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className="info-card-tool"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <SliceIcon type={icon} x={0} y={0} />
    </button>
  );
}

// A small card beside its button. A click outside it or Escape closes it.
function MenuCard({
  title,
  place,
  onClose,
  children,
}: {
  title: string;
  place: Place;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="info-card-backdrop" onClick={onClose}>
      <div
        className="info-card-modal"
        role="dialog"
        aria-label={title}
        style={place}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="info-card-modal-head">
          <span>{title}</span>
          <button
            type="button"
            className="info-card-done"
            aria-label="Done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LayoutMenu({
  layout,
  onPick,
}: {
  layout: InfoCardLayout;
  onPick: (layout: InfoCardLayout) => void;
}) {
  return (
    <div className="info-card-menu" role="radiogroup" aria-label="Layout">
      {(Object.keys(LAYOUT_NAMES) as InfoCardLayout[]).map((each) => (
        <label key={each} className="info-card-choice">
          <input
            type="radio"
            name="layout"
            checked={layout === each}
            onChange={() => onPick(each)}
          />
          {LAYOUT_NAMES[each]}
        </label>
      ))}
    </div>
  );
}

function FieldsMenu({
  fields,
  onChange,
}: {
  fields: InfoCardField[];
  onChange: (fields: InfoCardField[]) => void;
}) {
  return (
    <div className="info-card-menu" role="group" aria-label="Show on the card">
      {INFO_CARD_FIELDS.map((field) => (
        <label key={field} className="info-card-choice">
          <input
            type="checkbox"
            checked={fields.includes(field)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...fields, field]
                  : fields.filter((each) => each !== field),
              )
            }
          />
          {FIELD_NAMES[field]}
        </label>
      ))}
    </div>
  );
}

function CardContent({ state }: { state: InfoCardState }) {
  const { status, page, fields } = state;
  if (status === 'not-connected') {
    return (
      <Message>Connect Chrome to see page info. Set it up in Settings.</Message>
    );
  }
  if (status === 'no-page') {
    return <Message>This tab has no web page to read.</Message>;
  }
  if (status === 'failed') {
    return (
      <Message>
        Could not read this page. If the Pie extension was just updated, reload
        it in chrome://extensions.
      </Message>
    );
  }
  if (!page) {
    return <Message>Reading the page…</Message>;
  }
  if (fields.length === 0) {
    return (
      <Message>Nothing chosen. Pick what to show with the list button.</Message>
    );
  }
  return (
    <>
      {fields.map((field) => (
        <section key={field} className="info-card-section" data-field={field}>
          {SECTIONS[field](page)}
        </section>
      ))}
    </>
  );
}

function Message({ children }: { children: ReactNode }) {
  return <p className="info-card-message">{children}</p>;
}

// The canonical points at this very page. It may be written relative to the
// page, and the part after # is not part of the address.
export function sameAddress(canonical: string, pageUrl: string): boolean {
  try {
    const one = new URL(canonical, pageUrl);
    const two = new URL(pageUrl);
    one.hash = '';
    two.hash = '';
    return one.href === two.href;
  } catch {
    return false;
  }
}

// A count tile. With onClick it is a button that leads somewhere.
function Stat({
  value,
  label,
  warn = false,
  title,
  onClick,
}: {
  value: number;
  label: string;
  warn?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  const className = warn ? 'info-card-stat is-warn' : 'info-card-stat';
  if (onClick) {
    return (
      <button
        type="button"
        className={`${className} is-button`}
        title={title}
        onClick={onClick}
      >
        <strong>{value}</strong> {label}
      </button>
    );
  }
  return (
    <span className={className}>
      <strong>{value}</strong> {label}
    </span>
  );
}

const SECTIONS: Record<InfoCardField, (page: InfoCardPage) => ReactNode> = {
  title: (page) => (
    <>
      <h2 className="info-card-title">{page.title || 'No title'}</h2>
      <p className="info-card-url" title={page.url}>
        {page.url}
      </p>
      <p className="info-card-text">{page.description || 'No description'}</p>
      <span className="info-card-pill">Language: {page.lang || 'not set'}</span>
    </>
  ),
  canonical: (page) => (
    <>
      <h3>
        Canonical
        {page.canonical && sameAddress(page.canonical, page.url) && (
          <span className="info-card-pill is-good">Same site</span>
        )}
      </h3>
      <p
        className={page.canonical ? 'info-card-url is-whole' : 'info-card-text'}
      >
        {page.canonical || 'Not set'}
      </p>
    </>
  ),
  headings: (page) => (
    <>
      <h3>
        H1: <span className="info-card-count">{page.h1Count}</span>
      </h3>
      {page.h1s.map((text, index) => (
        <p key={index} className="info-card-quote">
          {text || '(empty)'}
        </p>
      ))}
    </>
  ),
  counts: (page) => (
    <>
      <h3>Counts</h3>
      <div className="info-card-stats">
        <Stat
          value={page.linkCount}
          label="links"
          title="Show the links: the Links card takes the Info Card's place"
          onClick={() => void infoCardBridge.setView('links')}
        />
        <Stat
          value={page.imageCount}
          label="images"
          title="Show the images: the Images card takes the Info Card's place"
          onClick={() => void infoCardBridge.setView('images')}
        />
        <Stat
          value={page.issueCount}
          label="issues"
          warn={page.issueCount > 0}
        />
      </div>
    </>
  ),
  tracking: (page) => (
    <>
      <h3>Tracking</h3>
      {page.trackers.length > 0 ? (
        <div className="info-card-pills">
          {page.trackers.map((name) => (
            <span key={name} className="info-card-pill is-accent">
              {name}
            </span>
          ))}
        </div>
      ) : (
        <p className="info-card-text">No trackers found</p>
      )}
      <p className="info-card-sub">UTM-tagged links: {page.utmTagged}</p>
    </>
  ),
  hyvor: (page) => (
    <>
      <h3>Hyvor Talk</h3>
      {page.hyvorTalk ? (
        <>
          <span className="info-card-pill is-good">Found</span>
          <dl className="info-card-pairs">
            {page.hyvorTalk.attributes.map(({ name, value }) => (
              <div key={name}>
                <dt>{name}:</dt> <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <span className="info-card-pill">None found</span>
      )}
    </>
  ),
  images: (page) => <FeaturedImages page={page} />,
};

// og:image first, as on Web Page's Social preview.
function FeaturedImages({ page }: { page: InfoCardPage }) {
  const shown = [...page.featuredImages]
    .sort(
      (a, b) =>
        Number(b.property === 'og:image') - Number(a.property === 'og:image'),
    )
    .slice(0, MAX_IMAGES);
  if (shown.length === 0) {
    return (
      <>
        <h3>Featured images</h3>
        <p className="info-card-text">None set</p>
      </>
    );
  }
  return (
    <>
      <h3>Featured images</h3>
      <div className="info-card-images">
        {shown.map(({ property, url }) => {
          const source = shareImageSource(url, page.url);
          return (
            <figure key={`${property} ${url}`} className="info-card-image">
              {source ? (
                <ChromeImage
                  className="info-card-thumb"
                  url={source}
                  size="thumb"
                  alt={property}
                  fallback={
                    <span className="info-card-thumb is-empty">No picture</span>
                  }
                />
              ) : (
                <span className="info-card-thumb is-empty">No picture</span>
              )}
              <figcaption>{property}</figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}
