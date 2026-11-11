import { BrowserWindow, session } from 'electron';
import type { Session, WebContents } from 'electron';
import type { SiteViewer } from '../page-info/page-info-controller';
import { isSiteUrl } from '../page-info/site-address';
import { isQuitting } from './quitting';

const PARTITION = 'persist:page-info';

let isSessionLocked = false;

export interface SiteEvents {
  hidden: () => void;
}

export function isSiteSession(candidate: Session): boolean {
  return candidate === session.fromPartition(PARTITION);
}

function lockSession(): void {
  if (isSessionLocked) {
    return;
  }
  isSessionLocked = true;
  const siteSession = session.fromPartition(PARTITION);
  siteSession.setPermissionRequestHandler((_contents, _name, answer) =>
    answer(false),
  );
  siteSession.setPermissionCheckHandler(() => false);
  siteSession.on('will-download', (event) => event.preventDefault());
}

// A failed load is reported through events, so its promise has nothing to add.
const loadIn = (contents: WebContents, url: string) => {
  void contents.loadURL(url).catch(() => undefined);
};

export function applySiteRules(contents: WebContents): void {
  contents.on('will-navigate', (event) => {
    if (!isSiteUrl(event.url)) {
      event.preventDefault();
    }
  });
  contents.on('will-redirect', (event) => {
    if (!isSiteUrl(event.url)) {
      event.preventDefault();
    }
  });
  // With no one to answer "leave this page?", the answer is always yes.
  contents.on('will-prevent-unload', (event) => event.preventDefault());
  // No pop-ups. A new-tab link the person can see just opens in place.
  contents.setWindowOpenHandler(({ url }) => {
    if (
      BrowserWindow.fromWebContents(contents)?.isVisible() &&
      isSiteUrl(url)
    ) {
      loadIn(contents, url);
    }
    return { action: 'deny' };
  });
}

// The browser window inside the app. It shows a page and nothing more: every
// check reads the page in Chrome.
export function createSiteViewer(
  events: SiteEvents,
): SiteViewer & { destroy: () => void } {
  lockSession();

  let site: BrowserWindow | null = null;
  let isBeingDestroyed = false;

  const createWindow = (): BrowserWindow => {
    const window = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        partition: PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        disableDialogs: true,
      },
    });
    window.setMenu(null);

    const { webContents: contents } = window;

    // With no address bar, the title bar is how you can tell where you are.
    window.on('page-title-updated', (event) => event.preventDefault());
    contents.on('did-navigate', (_event, url) => {
      if (isSiteUrl(url)) {
        window.setTitle(url);
      }
    });
    contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame) {
        window.setTitle(url);
      }
    });

    // Its X only hides it. Closing Page Info is what closes the site.
    window.on('close', (event) => {
      if (!isQuitting()) {
        event.preventDefault();
        hideWindow(window);
        events.hidden();
      }
    });

    // Only a page calling window.close() gets here while Page Info is open.
    window.on('closed', () => {
      site = null;
      if (!isBeingDestroyed && !isQuitting()) {
        events.hidden();
      }
    });

    return window;
  };

  // A hidden page stays quiet.
  const hideWindow = (window: BrowserWindow) => {
    window.webContents.setAudioMuted(true);
    window.hide();
  };

  return {
    show: (url) => {
      site ??= createWindow();
      if (site.webContents.getURL() !== url) {
        loadIn(site.webContents, url);
      }
      site.webContents.setAudioMuted(false);
      site.show();
      site.focus();
    },
    hide: () => {
      if (site) {
        hideWindow(site);
      }
    },
    destroy: () => {
      isBeingDestroyed = true;
      if (site && !site.isDestroyed()) {
        site.destroy();
      }
    },
  };
}
