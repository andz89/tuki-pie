import { BrowserWindow, app, ipcMain } from 'electron';
import type { IpcMainEvent } from 'electron';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipc-channels';
import { isQuitting } from './quitting';
import { saveBeforeClose } from './save-before-close';

// Long enough for one local database write, short enough not to feel stuck.
const SAVE_ON_CLOSE_MS = 2000;

let notesWindow: BrowserWindow | null = null;
// The note to show first. A new window picks it up as it loads; an open one
// is told.
let pendingNoteId: string | null = null;

export function takeNoteRequest(): string | null {
  const id = pendingNoteId;
  pendingNoteId = null;
  return id;
}

// Every note change reaches the window, also ones made from the card.
export function sendNotesChanged(): void {
  if (notesWindow && !notesWindow.isDestroyed()) {
    notesWindow.webContents.send(IpcChannels.notesChanged);
  }
}

function askToSave(window: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    const onSaved = (event: IpcMainEvent) => {
      if (event.sender === window.webContents) {
        ipcMain.removeListener(IpcChannels.notesSaved, onSaved);
        resolve();
      }
    };
    ipcMain.on(IpcChannels.notesSaved, onSaved);
    // Stops listening when the close goes ahead without an answer.
    window.once('closed', () =>
      ipcMain.removeListener(IpcChannels.notesSaved, onSaved),
    );
    window.webContents.send(IpcChannels.notesSaveRequested);
  });
}

export function openNotesWindow(noteId: string | null = null): void {
  pendingNoteId = noteId;
  if (notesWindow) {
    if (notesWindow.isMinimized()) {
      notesWindow.restore();
    }
    notesWindow.show();
    notesWindow.focus();
    if (noteId !== null) {
      notesWindow.webContents.send(IpcChannels.notesOpenRequested);
    }
    return;
  }

  const window = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 520,
    minHeight: 360,
    title: 'Notes',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#15181c',
    webPreferences: {
      preload: path.join(__dirname, 'notes-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenu(null);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/notes.html`);
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/notes.html`),
    );
  }

  window.once('ready-to-show', () => window.show());
  // Text typed in the last half second before closing is not saved yet.
  saveBeforeClose(window, () => askToSave(window), {
    timeoutMs: SAVE_ON_CLOSE_MS,
    isQuitting,
    quit: () => app.quit(),
  });
  window.on('closed', () => {
    notesWindow = null;
    pendingNoteId = null;
  });
  notesWindow = window;
}
