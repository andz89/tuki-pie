import { BrowserWindow, clipboard } from 'electron';
import { sameAddress } from '../../../packages/pie-extension/protocol.js';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipc-channels';
import type { OnTop } from '../../shared/schemas/settings.schema';
import { getChromeBridge } from '../chrome-bridge/chrome-connection';
import { createChromeSite } from '../chrome-bridge/chrome-site';
import { PageInfoController } from '../page-info/page-info-controller';
import { addressFromClipboard } from '../page-info/site-address';
import {
  activeTabAddress,
  chooseStartAddress,
} from '../page-info/start-address';
import { createSiteViewer } from './site-window';

let pageInfoWindow: BrowserWindow | null = null;
let controller: PageInfoController | null = null;
// A page that redirects ends on a different address than the one copied, so
// this is what stops the same copied address from loading again.
let lastCopiedAddress: string | null = null;
let keepOnTop = false;

export function getPageInfoController(): PageInfoController | null {
  return controller;
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

// Clicking the slice checks the active Chrome tab, or failing that, a newly
// copied address. Every check runs in Chrome, so nothing happens without it.
export async function openPageInfo(): Promise<void> {
  const active = showOrCreateWindow();
  const checksBefore = active.checkCount();
  const [activeTab, copiedText] = await Promise.all([
    activeChromeTab(),
    clipboard.readText().catch(() => ''),
  ]);
  // The window closed, or you started a check yourself, while waiting.
  if (active !== controller || active.checkCount() !== checksBefore) {
    return;
  }
  const choice = chooseStartAddress({
    activeTab,
    copied: addressFromClipboard(copiedText),
    lastCopied: lastCopiedAddress,
    shown: active.state().address,
  });
  if (choice === null || !active.state().chromeConnected) {
    return;
  }
  if (choice.fromClipboard) {
    lastCopiedAddress = choice.address;
  }
  active.check(choice.address);
}

// Ctrl+Tab through several tabs only checks the one you stop on.
const FOLLOW_TAB_MS = 300;
let followTimer: ReturnType<typeof setTimeout> | undefined;

// While the window is open, switching Chrome tabs checks the new active tab.
function followActiveTab(): void {
  clearTimeout(followTimer);
  followTimer = setTimeout(() => void checkActiveTab(), FOLLOW_TAB_MS);
}

async function checkActiveTab(): Promise<void> {
  const active = controller;
  if (!active?.state().chromeConnected) {
    return;
  }
  const checksBefore = active.checkCount();
  const activeTab = await activeChromeTab();
  if (active !== controller || active.checkCount() !== checksBefore) {
    return;
  }
  const shown = active.state().address;
  if (activeTab === null || (shown !== null && sameAddress(activeTab, shown))) {
    return;
  }
  active.check(activeTab);
}

function showOrCreateWindow(): PageInfoController {
  if (pageInfoWindow && controller) {
    if (pageInfoWindow.isMinimized()) {
      pageInfoWindow.restore();
    }
    pageInfoWindow.show();
    pageInfoWindow.focus();
    return controller;
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

  const toController = (run: (active: PageInfoController) => void) => () => {
    if (controller) {
      run(controller);
    }
  };
  // The in-app browser only shows the page. Chrome is where it is read.
  const viewer = createSiteViewer({
    hidden: toController((c) => c.siteHidden()),
  });
  const bridge = getChromeBridge();
  const chromeSite = createChromeSite(
    bridge ?? {
      request: () => Promise.reject(new Error('not-connected')),
      onEvent: () => () => undefined,
    },
    {
      committed: toController((c) => c.sitePageCommitted()),
      loaded: toController((c) => c.siteLoaded()),
      changedInPlace: toController((c) => c.sitePageChangedInPlace()),
      failed: (errorCode) => toController((c) => c.siteFailed(errorCode))(),
      cancelled: toController((c) => c.siteCancelled()),
      closed: toController((c) => c.siteClosed()),
    },
  );
  const created = new PageInfoController(chromeSite, viewer, (update) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IpcChannels.pageInfoUpdate, update);
    }
  });
  created.setChromeConnected(bridge?.status() === 'connected');
  const stopWatchingChrome =
    bridge?.onStatus((status) =>
      created.setChromeConnected(status === 'connected'),
    ) ?? (() => undefined);
  const stopFollowingTabs =
    bridge?.onEvent((name) => {
      if (name === 'activeTabChanged') {
        followActiveTab();
      }
    }) ?? (() => undefined);

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    created.dispose();
    stopWatchingChrome();
    stopFollowingTabs();
    clearTimeout(followTimer);
    chromeSite.destroy();
    viewer.destroy();
    controller = null;
    pageInfoWindow = null;
    lastCopiedAddress = null;
  });

  pageInfoWindow = window;
  controller = created;
  return created;
}
