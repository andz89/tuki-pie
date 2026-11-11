import { BrowserWindow } from 'electron';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipc-channels';

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
  window.on('closed', () => {
    notesWindow = null;
    pendingNoteId = null;
  });
  notesWindow = window;
}
