import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipc-channels';
import { PIE_SCALES } from '../../shared/schemas/settings.schema';
import type { Pin, PieSize } from '../../shared/schemas/settings.schema';
import { LIST_EXTRA_WIDTH } from '../../shared/types';
import type { ListSide } from '../../shared/types';
import { WINDOW_SIZE, pieWindowBounds } from './pie-position';
import { isQuitting } from './quitting';
import { setWindowRole } from '../ipc/ipc-access';

let pieWindow: BrowserWindow | null = null;
let scale = 1;
let pinned = false;
let closing: NodeJS.Timeout | null = null;
let listSide: ListSide | null = null;
let beforeOpen: () => void = () => {};

// Runs just before a closed donut shows, while the window it opens over is
// still the one in front.
export function setBeforePieOpens(listener: () => void): void {
  beforeOpen = listener;
}

// A little longer than the fade in pie.css, so the last thing the hidden window
// painted is an empty frame. Otherwise the old donut flashes on the next open.
const CLOSE_ANIMATION_MS = 120;

function windowSide(): number {
  return Math.round(WINDOW_SIZE * scale);
}

// Wider while the Shortcuts list is open, so it sits beside the donut.
function windowWidth(): number {
  const extra = listSide ? LIST_EXTRA_WIDTH : 0;
  return Math.round((WINDOW_SIZE + extra) * scale);
}

// With the list on the left, the donut's square starts this far in.
function squareOffset(): number {
  return listSide === 'left' ? windowWidth() - windowSide() : 0;
}

export function createPieWindow(): void {
  const window = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Decides which messages this window may send, see ipc-access.ts.
  setWindowRole(window.webContents, 'pie');

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // The page loads while hidden, so this makes the very first opening animate.
  window.webContents.on('did-finish-load', () => {
    if (!window.isVisible()) {
      window.webContents.send(IpcChannels.windowPhase, 'closing');
    }
  });

  // A crashed page would leave an empty, unclickable window on the next open.
  window.webContents.on('render-process-gone', () => {
    window.webContents.reload();
  });

  // Clicking anywhere outside the window closes the donut, unless it's pinned.
  window.on('blur', dismissPieWindow);

  // Alt+F4 only hides the donut. Closing it would quit the app (no other
  // window open) or leave a destroyed window behind every hotkey.
  window.on('close', (event) => {
    if (!isQuitting()) {
      event.preventDefault();
      hidePieWindow();
    }
  });

  // Gone anyway (closed while quitting, or by the system): the next open
  // makes a new one.
  window.on('closed', () => {
    if (pieWindow !== window) {
      return;
    }
    pieWindow = null;
    listSide = null;
    if (closing) {
      clearTimeout(closing);
      closing = null;
    }
  });

  pieWindow = window;
}

export function isPieWindowOpen(): boolean {
  return (pieWindow?.isVisible() ?? false) && !closing;
}

export function showPieWindowAtCursor(): void {
  if (!pieWindow) {
    createPieWindow();
  }
  if (!pieWindow) {
    return;
  }
  // Already open, the donut itself is in front, which says nothing new.
  if (!isPieWindowOpen()) {
    beforeOpen();
  }
  const cursor = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(cursor);
  if (closing) {
    clearTimeout(closing);
    closing = null;
  }
  listSide = null;
  pieWindow.setBounds(pieWindowBounds(cursor, workArea, scale));
  pieWindow.webContents.send(IpcChannels.windowPhase, 'opening');
  pieWindow.show();
  pieWindow.focus();
}

export function hidePieWindow(): void {
  if (!pieWindow?.isVisible() || closing) {
    return;
  }
  pieWindow.webContents.send(IpcChannels.windowPhase, 'closing');
  closing = setTimeout(() => {
    closing = null;
    pieWindow?.hide();
  }, CLOSE_ANIMATION_MS);
}

// What a click does. A pinned donut ignores every click, inside or outside it.
export function dismissPieWindow(): void {
  if (!pinned) {
    hidePieWindow();
  }
}

export function isPiePinned(): boolean {
  return pinned;
}

// Brings the donut back where it was, after it stepped aside for a screenshot.
export function showPieWindowInPlace(): void {
  if (!pieWindow || pieWindow.isVisible()) {
    return;
  }
  pieWindow.webContents.send(IpcChannels.windowPhase, 'opening');
  pieWindow.showInactive();
}

export function setPiePin(pin: Pin): void {
  pinned = pin === 'pinned';
  // Unpinned from the settings window, the donut no longer has focus to lose,
  // so no click away would ever close it.
  if (!pinned && !pieWindow?.isFocused()) {
    hidePieWindow();
  }
}

export function movePieWindowBy(deltaX: number, deltaY: number): void {
  if (!pieWindow) {
    return;
  }
  const { x, y } = pieWindow.getBounds();
  // Passing the size too stops the window from slowly growing on scaled displays.
  pieWindow.setBounds({
    x: x + deltaX,
    y: y + deltaY,
    width: windowWidth(),
    height: windowSide(),
  });
}

// Grows the window sideways for the Shortcuts list, or back to a square. The
// donut stays exactly where it is on screen.
export function setPieListSide(side: ListSide | null): void {
  if (!pieWindow || side === listSide) {
    return;
  }
  const { x, y } = pieWindow.getBounds();
  const squareX = x + squareOffset();
  listSide = side;
  pieWindow.setBounds({
    x: squareX - squareOffset(),
    y,
    width: windowWidth(),
    height: windowSide(),
  });
}

// Resizes around the window's center, so the donut grows in place.
export function setPieSize(size: PieSize): void {
  const previousSide = windowSide();
  scale = PIE_SCALES[size];
  if (!pieWindow || windowSide() === previousSide) {
    return;
  }

  const { x, y } = pieWindow.getBounds();
  const shift = Math.round((previousSide - windowSide()) / 2);
  pieWindow.setBounds({
    x: x + shift,
    y: y + shift,
    width: windowWidth(),
    height: windowSide(),
  });
}
