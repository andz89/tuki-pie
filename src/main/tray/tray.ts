import { Menu, Tray, nativeImage } from 'electron';
import { donutBitmap } from './tray-icon';

const ICON_PIXELS = 32;

interface TrayActions {
  openSettings: () => void;
  quit: () => void;
}

// Kept in a variable so the icon isn't cleaned up while the app is running.
let tray: Tray | null = null;

export function createTray({ openSettings, quit }: TrayActions): void {
  const icon = nativeImage.createFromBitmap(donutBitmap(ICON_PIXELS), {
    width: ICON_PIXELS,
    height: ICON_PIXELS,
    scaleFactor: 2,
  });

  tray = new Tray(icon);
  tray.setToolTip('Pie Launcher');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Settings', click: openSettings },
      { type: 'separator' },
      { label: 'Quit', click: quit },
    ]),
  );
  tray.on('click', openSettings);
}
