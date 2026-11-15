import { BrowserWindow, clipboard } from 'electron';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipc-channels';
import type { OnTop } from '../../shared/schemas/settings.schema';
import { getChromeBridge } from '../chrome-bridge/chrome-connection';
import { createChromeSite } from '../chrome-bridge/chrome-site';
import { PageInfoController } from '../page-info/page-info-controller';
import { PageImages } from '../page-info/page-images';
import { PageInfoTabs } from '../page-info/page-info-tabs';
import type { OpenSiteTab } from '../page-info/page-info-tabs';
import { addressFromClipboard } from '../page-info/site-address';
import {
  activeTabAddress,
  chooseStartAddress,
} from '../page-info/start-address';
import { createSiteViewer } from './site-window';
import { setWindowRole } from '../ipc/ipc-access';

let pageInfoWindow: BrowserWindow | null = null;
// Each tab also keeps the pictures of its page, fetched by Chrome.
type SiteTab = OpenSiteTab & { images: PageImages };

let tabs: PageInfoTabs<SiteTab> | null = null;
// A page that redirects ends on a different address than the one copied, so
// this is what stops the same copied address from loading again.
let lastCopiedAddress: string | null = null;
let keepOnTop = false;

// The active tab's controller. Every page action works on it.
export function getPageInfoController(): PageInfoController | null {
  return tabs?.active() ?? null;
}

export function getPageInfoTabs(): PageInfoTabs<SiteTab> | null {
  return tabs;
}

export function getPageInfoImages(): PageImages | null {
  return tabs?.activeTab().images ?? null;
}

// The screenshot may bring Chrome to the front; the window you clicked in
// comes back.
export function focusPageInfoWindow(): void {
  if (pageInfoWindow && !pageInfoWindow.isDestroyed()) {
    pageInfoWindow.focus();
  }
}

// Keeps the window above other windows, so it stays in view while you work
// in Chrome.
export function setPageInfoOnTop(onTop: OnTop): void {
  keepOnTop = onTop === 'on-top';
  pageInfoWindow?.setAlwaysOnTop(keepOnTop);
}

// The window stays open beside Chrome, so you can keep working from it.
export function goToChromeTab(): void {
  const controller = getPageInfoController();
  if (!pageInfoWindow || !controller?.state().chromeConnected) {
    return;
  }
  if (controller.state().address !== null) {
    controller.goToTab();
  }
}

// Short, so a slow Chrome never holds up the window.
const ACTIVE_TAB_LIMIT_MS = 1500;

async function activeChromeTab(): Promise<string | null> {
  const bridge = getChromeBridge();
  if (bridge?.status() !== 'connected') {
    return null;
  }
  const answer = await bridge
    .request('activeTab', undefined, ACTIVE_TAB_LIMIT_MS)
    .catch(() => null);
  return activeTabAddress(answer);
}

// A saved site checked live: in the active tab when it is still empty,
// otherwise in a new tab.
export function checkInPageInfo(address: string): void {
  showOrCreateWindow();
  const active = tabs?.active();
  if (!tabs || !active) {
    return;
  }
  // The window may be showing the saved list in place of its tabs.
  pageInfoWindow?.webContents.send(IpcChannels.pageInfoShowTabs);
  const { address: shown, status } = active.state();
  if (shown === null && status === 'idle') {
    active.check(address);
  } else {
    tabs.add(address);
  }
}

// A saved site changed: the saved list shown in this window catches up.
export function sendSavedSitesChangedToPageInfo(): void {
  if (pageInfoWindow && !pageInfoWindow.isDestroyed()) {
    pageInfoWindow.webContents.send(IpcChannels.savedSitesChanged);
  }
}

// Whether a copied address may be checked without a click on it. Set from
// main.ts with the Links filter; nothing until then.
let isCopiedSafe: (address: string) => boolean = () => false;

export function setCopiedAddressRule(rule: (address: string) => boolean): void {
  isCopiedSafe = rule;
}

// Clicking the slice checks the active Chrome tab, or failing that, a newly
// copied address. Every check runs in Chrome, so nothing happens without it.
export async function openPageInfo(): Promise<void> {
  const active = showOrCreateWindow();
  const checksBefore = active.checkCount();
  const [activeTab, copiedText] = await Promise.all([
    activeChromeTab(),
    clipboard.readText().catch(() => ''),
  ]);
  // The window closed, you switched tabs, or you started a check yourself,
  // while waiting.
  if (
    active !== getPageInfoController() ||
    active.checkCount() !== checksBefore
  ) {
    return;
  }
  const choice = chooseStartAddress({
    activeTab,
    copied: addressFromClipboard(copiedText),
    lastCopied: lastCopiedAddress,
    shown: active.state().address,
    isSafeToOpen: isCopiedSafe,
  });
  if (choice === null || !active.state().chromeConnected) {
    return;
  }
  if (choice.fromClipboard) {
    lastCopiedAddress = choice.address;
  }
  active.check(choice.address);
}

function showOrCreateWindow(): PageInfoController {
  if (pageInfoWindow && tabs) {
    if (pageInfoWindow.isMinimized()) {
      pageInfoWindow.restore();
    }
    pageInfoWindow.show();
    pageInfoWindow.focus();
    return tabs.active();
  }

  const window = new BrowserWindow({
    width: 640,
    height: 720,
    minWidth: 420,
    minHeight: 400,
    title: 'Web Page',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#15181c',
    webPreferences: {
      preload: path.join(__dirname, 'page-info-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Decides which messages this window may send, see ipc-access.ts.
  setWindowRole(window.webContents, 'page-info');
  window.setMenu(null);
  window.setAlwaysOnTop(keepOnTop);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/page-info.html`);
  } else {
    window.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/page-info.html`,
      ),
    );
  }

  const send = (channel: string, value: unknown) => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, value);
    }
  };
  // The in-app browser only shows the page. Chrome is where it is read.
  const viewer = createSiteViewer({
    hidden: () => tabs?.active().siteHidden(),
  });
  const bridge = getChromeBridge();
  const created = new PageInfoTabs({
    make: (id, sendUpdate) => {
      // Each tab's events reach only its own controller.
      let tabController: PageInfoController | null = null;
      const to = (run: (c: PageInfoController) => void) => () => {
        if (tabController) {
          run(tabController);
        }
      };
      const chromeSite = createChromeSite(
        bridge ?? {
          request: () => Promise.reject(new Error('not-connected')),
          onEvent: () => () => undefined,
        },
        id,
        {
          committed: to((c) => c.sitePageCommitted()),
          loaded: to((c) => c.siteLoaded()),
          changedInPlace: to((c) => c.sitePageChangedInPlace()),
          failed: (errorCode) => to((c) => c.siteFailed(errorCode))(),
          cancelled: to((c) => c.siteCancelled()),
          closed: to((c) => c.siteClosed()),
        },
      );
      const controller = new PageInfoController(
        chromeSite,
        viewer,
        sendUpdate,
        id,
      );
      tabController = controller;
      controller.setChromeConnected(bridge?.status() === 'connected');
      const images = new PageImages({
        request: (action, args, timeoutMs) =>
          bridge
            ? bridge.request(action, args, timeoutMs)
            : Promise.reject(new Error('not-connected')),
        currentPage: () => {
          const { report, reportId } = controller.state();
          return report
            ? {
                reportId,
                url: report.url,
                images: report.images,
                featuredImages: report.featuredImages.map(({ url }) => url),
              }
            : null;
        },
      });
      return {
        controller,
        images,
        forget: () => chromeSite.forget(),
        destroy: () => chromeSite.destroy(),
      };
    },
    sendUpdate: (update) => send(IpcChannels.pageInfoUpdate, update),
    sendTabs: (list) => send(IpcChannels.pageInfoTabs, list),
  });
  const stopWatchingChrome =
    bridge?.onStatus((status) => {
      for (const each of created.controllers()) {
        each.setChromeConnected(status === 'connected');
      }
    }) ?? (() => undefined);
  // An event with no tab comes from an extension older than this app.
  const stopWatchingVersion =
    bridge?.onEvent((_name, site) => {
      if (site === null) {
        for (const each of created.controllers()) {
          each.extensionOutdated();
        }
      }
    }) ?? (() => undefined);

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    stopWatchingChrome();
    stopWatchingVersion();
    created.dispose();
    viewer.destroy();
    tabs = null;
    pageInfoWindow = null;
    lastCopiedAddress = null;
  });

  pageInfoWindow = window;
  tabs = created;
  return created.active();
}
