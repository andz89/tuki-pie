import { BrowserWindow } from 'electron';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipc-channels';
import { setWindowRole } from '../ipc/ipc-access';

let savedSitesWindow: BrowserWindow | null = null;

// A saved site changed: the open list catches up.
export function sendSavedSitesChanged(): void {
  if (savedSitesWindow && !savedSitesWindow.isDestroyed()) {
    savedSitesWindow.webContents.send(IpcChannels.savedSitesChanged);
  }
}

// The saved list in its own window, or that window brought forward.
export function openSavedSitesWindow(): void {
  if (savedSitesWindow) {
    if (savedSitesWindow.isMinimized()) {
      savedSitesWindow.restore();
    }
    savedSitesWindow.show();
    savedSitesWindow.focus();
    return;
  }

  const window = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 560,
    minHeight: 400,
    title: 'Saved sites',
    show: false,
    autoHideMenuBar: true,
    // Violet-tinted, so it never reads as the Page Info window.
    backgroundColor: '#1a1626',
    webPreferences: {
      preload: path.join(__dirname, 'saved-sites-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Decides which messages this window may send, see ipc-access.ts.
  setWindowRole(window.webContents, 'saved-sites');
  window.setMenu(null);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/saved-sites.html`);
  } else {
    window.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/saved-sites.html`,
      ),
    );
  }

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    savedSitesWindow = null;
  });
  savedSitesWindow = window;
}
