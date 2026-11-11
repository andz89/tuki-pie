import { BrowserWindow } from 'electron';
import type { Display, NativeImage } from 'electron';
import path from 'node:path';
import type { Area } from '../screenshot/screenshot-geometry';
import { setWindowRole } from '../ipc/ipc-access';

type PickDone = (selection: Area | null) => void | Promise<void>;

interface Picking {
  window: BrowserWindow;
  image: NativeImage;
  done: PickDone;
}

let picking: Picking | null = null;

// Covers the whole display with the frozen picture, so the person can drag
// out the part they want.
export function openSectionPicker(
  image: NativeImage,
  display: Display,
  done: PickDone,
): void {
  // Starting again while one is open replaces it.
  finishPicking(null);

  const { bounds } = display;
  const window = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    backgroundColor: '#000000',
    title: 'Screenshot',
    webPreferences: {
      preload: path.join(__dirname, 'screenshot-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Decides which messages this window may send, see ipc-access.ts.
  setWindowRole(window.webContents, 'screenshot');
  window.setAlwaysOnTop(true, 'screen-saver');

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/screenshot.html`);
  } else {
    window.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/screenshot.html`,
      ),
    );
  }

  window.once('ready-to-show', () => {
    // Set again once shown, because Windows can shift it on scaled displays.
    window.setBounds(bounds);
    window.show();
    window.focus();
  });
  // Switching to another window gives up, like pressing Esc.
  window.on('blur', () => finishPicking(null));
  window.on('closed', () => {
    if (picking?.window === window) {
      const { done: finish } = picking;
      picking = null;
      void finish(null);
    }
  });

  picking = { window, image, done };
}

// Only the picker's background: a JPEG encodes many times faster than a
// full-screen PNG. The saved part is cut from the original picture.
const PICKER_JPEG_QUALITY = 90;

export function sectionPickerImage(): string | null {
  if (!picking) {
    return null;
  }
  const jpeg = picking.image.toJPEG(PICKER_JPEG_QUALITY);
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

export function finishPicking(selection: Area | null): void {
  if (!picking) {
    return;
  }
  const { window, done } = picking;
  picking = null;
  if (!window.isDestroyed()) {
    window.close();
  }
  void done(selection);
}
