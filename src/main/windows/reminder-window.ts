import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipc-channels';
import type { DueReminder } from '../../shared/schemas/note.schema';

export const CARD_WIDTH = 360;
const EDGE_GAP = 16;
const START_HEIGHT = 140;
const MIN_HEIGHT = 80;

let cardWindow: BrowserWindow | null = null;
let showing: DueReminder[] = [];

export function dueReminders(): DueReminder[] {
  return showing;
}

// Top right of the main screen, clear of the taskbar.
export function cardBounds(
  workArea: { x: number; y: number; width: number; height: number },
  height: number,
) {
  const fitted = Math.round(
    Math.min(Math.max(height, MIN_HEIGHT), workArea.height - 2 * EDGE_GAP),
  );
  return {
    x: workArea.x + workArea.width - CARD_WIDTH - EDGE_GAP,
    y: workArea.y + EDGE_GAP,
    width: CARD_WIDTH,
    height: fitted,
  };
}

// The card says how tall its content is, so the window fits it.
export function fitReminderCard(height: number): void {
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.setBounds(
      cardBounds(screen.getPrimaryDisplay().workArea, height),
    );
  }
}

// Shows the card while anything is due, and closes it when nothing is.
export function showReminders(due: DueReminder[]): void {
  showing = due;
  if (due.length === 0) {
    cardWindow?.close();
    return;
  }
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.webContents.send(IpcChannels.reminderUpdate);
    if (!cardWindow.isVisible()) {
      cardWindow.showInactive();
    }
    return;
  }

  const window = new BrowserWindow({
    ...cardBounds(screen.getPrimaryDisplay().workArea, START_HEIGHT),
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Note reminder',
    backgroundColor: '#15181c',
    webPreferences: {
      preload: path.join(__dirname, 'reminder-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Above ordinary always-on-top windows, like Page Info kept on top.
  window.setAlwaysOnTop(true, 'pop-up-menu');

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/reminder.html`);
  } else {
    window.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/reminder.html`,
      ),
    );
  }

  // Never takes the keyboard from what you are doing.
  window.once('ready-to-show', () => window.showInactive());
  window.on('closed', () => {
    cardWindow = null;
  });
  cardWindow = window;
}
