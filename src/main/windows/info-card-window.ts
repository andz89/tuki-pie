import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipc-channels';
import {
  fieldsFromSetting,
  fieldsToSetting,
} from '../../shared/schemas/info-card.schema';
import type {
  InfoCardField,
  InfoCardLayout,
  InfoCardView,
  LinksOpenIn,
} from '../../shared/schemas/info-card.schema';
import { readLinkFilter } from '../../shared/link-rules';
import { allowedCardLinks, highlightWords } from '../info-card/card-links';
import type { LinkFilter } from '../../shared/link-rules';
import type { InfoCardState, LinkSpot } from '../../shared/types';
import { getChromeBridge } from '../chrome-bridge/chrome-connection';
import { InfoCardReader, READ_LIMIT_MS } from '../info-card/info-card-reader';
import { infoCardBounds, listCardBounds } from '../info-card/info-card-bounds';
import { UserError } from '../services/user-error';
import { frontApp } from '../info-card/front-app';
import { InfoCardVisibility } from '../info-card/info-card-visibility';
import { setWindowRole } from '../ipc/ipc-access';
import { checkInPageInfo } from './page-info-window';
import { PageImages } from '../page-info/page-images';
import type { SettingsService } from '../services/settings.service';
import { ACTIVE_TAB_SITE } from '../../../packages/pie-extension/protocol.js';

// The page under the card shows through a little.
const OPACITY = 0.95;

interface OpenCard {
  window: BrowserWindow;
  reader: InfoCardReader;
  images: PageImages;
  pinned: boolean;
  view: InfoCardView;
  // The page the highlight field last marked, cleared when the card closes.
  marked: string | null;
  stop: () => void;
}

let card: OpenCard | null = null;
let settings: SettingsService | null = null;

// Called once at start, so the card can read and save its layout and fields.
export function setInfoCardSettings(service: SettingsService): void {
  settings = service;
}

// A setting changed elsewhere (the theme, say): an open card shows it.
export function infoCardSettingsChanged(): void {
  sendState();
}

export function infoCardState(): InfoCardState | null {
  if (!card || !settings) {
    return null;
  }
  const saved = settings.get();
  const { status, page, pageId } = card.reader.current();
  return {
    status,
    page,
    pageId,
    view: card.view,
    pinned: card.pinned,
    layout: saved.infoCardLayout,
    fields: fieldsFromSetting(saved.infoCardFields),
    theme: saved.theme,
    linkFilter: saved.linkFilter,
    linksOpenIn: saved.linksOpenIn,
  };
}

function sendState(): void {
  const state = infoCardState();
  if (card && state && !card.window.isDestroyed()) {
    card.window.webContents.send(IpcChannels.infoCardUpdate, state);
  }
}

export function infoCardImages(): PageImages | null {
  return card?.images ?? null;
}

// Pinned, the card stays when you click elsewhere. Unpinned, it closes.
export function setInfoCardPinned(pinned: boolean): void {
  if (card) {
    card.pinned = pinned;
    sendState();
  }
}

export function setInfoCardLayout(layout: InfoCardLayout): void {
  settings?.update({ infoCardLayout: layout });
  if (card) {
    place(card.window, layout, card.view);
    sendState();
  }
}

// The Info Card turns into the Links card, or back.
export function setInfoCardView(view: InfoCardView): void {
  if (card && settings) {
    card.view = view;
    place(card.window, settings.get().infoCardLayout, view);
    sendState();
  }
}

// The Links card's links, checked against the card page and the filters.
function cardLinks(urls: string[], ticked: Set<string>): string[] {
  if (!card || !settings) {
    return [];
  }
  return allowedCardLinks(
    urls,
    ticked,
    card.reader.current().page,
    readLinkFilter(settings.get().linkFilter),
  );
}

// Outlines a link in the Chrome tab in front, while it shows the card page.
export async function showInfoCardLink(
  index: number,
  href: string,
): Promise<LinkSpot | null> {
  const page = card?.reader.current().page;
  const bridge = getChromeBridge();
  const link = page?.links[index];
  if (!page || !bridge || link?.href !== href) {
    return null;
  }
  const spot = await bridge
    .request('showActiveLink', { index, href, url: page.url })
    .catch(() => null);
  return spot === 'shown' || spot === 'hidden' || spot === 'not-found'
    ? spot
    : null;
}

// Marks the words of the Links card's highlight field in the text of the
// Chrome tab in front, with mark.js, while it shows the card page. Empty
// text clears the marks. How many places were marked, or null when Chrome
// did not answer (not connected, or an extension without this).
export async function highlightInfoCardPage(
  text: string,
): Promise<number | null> {
  const page = card?.reader.current().page;
  const bridge = getChromeBridge();
  if (!page || bridge?.status() !== 'connected') {
    return null;
  }
  const words = highlightWords(text);
  if (card) {
    card.marked = words.length > 0 ? page.url : null;
  }
  const count = await bridge
    .request('highlightActive', { words, url: page.url })
    .catch(() => null);
  return typeof count === 'number' && count >= 0 ? count : null;
}

// Background tabs in Chrome. False when Chrome is not connected.
export function openInfoCardLinks(urls: string[], ticked: string[]): boolean {
  const bridge = getChromeBridge();
  if (bridge?.status() !== 'connected') {
    return false;
  }
  const allowed = cardLinks(urls, new Set(ticked));
  if (allowed.length > 0) {
    bridge.request('openTabs', { urls: allowed }).catch(() => undefined);
  }
  return allowed.length > 0;
}

// One link checked in its own Web Page tab.
export function openInfoCardLinkHere(href: string, ticked: boolean): void {
  const [allowed] = cardLinks([href], new Set(ticked ? [href] : []));
  if (!allowed) {
    throw new UserError(
      'This link is hidden by your Link filters, or no longer on the page.',
    );
  }
  checkInPageInfo(allowed);
}

// Where the Links card opens links, remembered for next time.
export function setLinksOpenIn(openIn: LinksOpenIn): void {
  settings?.update({ linksOpenIn: openIn });
  sendState();
}

// The same saved filters Web Page uses.
export function setInfoCardLinkFilter(filter: LinkFilter): void {
  settings?.update({ linkFilter: JSON.stringify(filter) });
  sendState();
}

export function setInfoCardFields(fields: InfoCardField[]): void {
  settings?.update({ infoCardFields: fieldsToSetting(fields) });
  sendState();
}

// The address comes from what the card read, never from the card window.
export function openInfoCardInWebPage(): void {
  const address = card?.reader.current().page?.url;
  if (address) {
    checkInPageInfo(address);
  }
}

export function closeInfoCard(): void {
  card?.window.close();
}

// On the screen where the mouse is, which is where the pie was opened.
function place(
  window: BrowserWindow,
  layout: InfoCardLayout,
  view: InfoCardView,
): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  window.setBounds(
    view !== 'info'
      ? listCardBounds(display.workArea)
      : infoCardBounds(layout, display.workArea),
  );
}

// The card, or the open one brought forward and read again. Picked from the
// pie, it is always the Info Card.
export function openInfoCard(): void {
  if (card) {
    setInfoCardView('info');
    card.window.show();
    card.window.focus();
    void card.reader.read();
    return;
  }
  const layout = settings?.get().infoCardLayout ?? 'sidebar';
  const window = new BrowserWindow({
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    opacity: OPACITY,
    title: 'Info Card',
    // See-through around the card, so it can have rounded corners and a
    // shadow (info-card.css).
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'info-card-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Decides which messages this window may send, see ipc-access.ts.
  setWindowRole(window.webContents, 'info-card');
  window.setMenu(null);
  place(window, layout, 'info');

  const bridge = getChromeBridge();
  const connected = () => bridge?.status() === 'connected';
  const reader = new InfoCardReader({
    isConnected: connected,
    readActive: () =>
      bridge
        ? bridge.request('readActive', {}, READ_LIMIT_MS)
        : Promise.reject(new Error('not-connected')),
    changed: sendState,
  });
  const images = new PageImages({
    request: (action, args, timeoutMs) =>
      bridge
        ? bridge.request(action, args, timeoutMs)
        : Promise.reject(new Error('not-connected')),
    currentPage: () => {
      const { page, pageId } = reader.current();
      return page
        ? {
            reportId: pageId,
            url: page.url,
            // The Images card shows every image; only these are fetched.
            images: page.images,
            featuredImages: page.featuredImages.map(({ url }) => url),
          }
        : null;
    },
  });
  const visibility = new InfoCardVisibility({
    frontApp,
    show: () => {
      if (!window.isDestroyed() && !window.isVisible()) {
        // Without taking focus from Chrome.
        window.showInactive();
      }
    },
    hide: () => {
      if (!window.isDestroyed() && window.isVisible()) {
        window.hide();
      }
    },
  });
  const stopEvents =
    bridge?.onEvent((name, site) => {
      if (name === 'activeTabChanged' && site === ACTIVE_TAB_SITE) {
        reader.tabChanged();
      }
    }) ?? (() => undefined);
  const stopStatus =
    bridge?.onStatus(() => void reader.read()) ?? (() => undefined);

  const opened: OpenCard = {
    window,
    reader,
    images,
    pinned: false,
    view: 'info',
    marked: null,
    stop: () => {
      stopEvents();
      stopStatus();
      visibility.stop();
      reader.stop();
    },
  };
  card = opened;

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/info-card.html`);
  } else {
    window.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/info-card.html`,
      ),
    );
  }

  window.once('ready-to-show', () => {
    window.show();
    window.focus();
    // From now on the card shows only while Chrome is in front.
    visibility.start();
  });
  window.on('blur', () => {
    if (!opened.pinned && !window.isDestroyed()) {
      window.close();
    }
  });
  window.on('closed', () => {
    // The window is gone before its own clean-up can ask for this.
    if (opened.marked && bridge?.status() === 'connected') {
      bridge
        .request('highlightActive', { words: [], url: opened.marked })
        .catch(() => undefined);
    }
    opened.stop();
    if (card === opened) {
      card = null;
    }
  });
  void reader.read();
}
