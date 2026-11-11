import { BrowserWindow } from 'electron';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipc-channels';
import type { PanelFormRequest } from '../../shared/types';

let panelWindow: BrowserWindow | null = null;
let pendingForm: PanelFormRequest | null = null;

export function getPanelWindow(): BrowserWindow | null {
  return panelWindow;
}

// A new window picks this up as it loads. An open one has to be told.
export function requestPanelForm(request: PanelFormRequest): void {
  pendingForm = request;
  const wasOpen = panelWindow !== null;
  openPanelWindow();
  if (wasOpen) {
    panelWindow?.webContents.send(IpcChannels.panelFormRequested);
  }
}

export function takePanelFormRequest(): PanelFormRequest | null {
  const request = pendingForm;
  pendingForm = null;
  return request;
}

export function openPanelWindow(): void {
  if (panelWindow) {
    if (panelWindow.isMinimized()) {
      panelWindow.restore();
    }
    panelWindow.show();
    panelWindow.focus();
    return;
  }

  const window = new BrowserWindow({
    width: 760,
    height: 760,
    minWidth: 560,
    minHeight: 480,
    title: 'Pie Launcher Settings',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#15181c',
    webPreferences: {
      preload: path.join(__dirname, 'panel-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenu(null);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/panel.html`);
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/panel.html`),
    );
  }

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    panelWindow = null;
  });

  panelWindow = window;
}
