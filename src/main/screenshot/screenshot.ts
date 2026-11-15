import { Notification, app, desktopCapturer, screen, shell } from 'electron';
import type { Display, NativeImage } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ScreenshotMode } from '../../shared/types';
import { UserError } from '../services/user-error';
import { copyPicture } from './picture';
import {
  hidePieWindow,
  isPieWindowOpen,
  isPiePinned,
  showPieWindowInPlace,
} from '../windows/pie-window';
import { openSectionPicker } from '../windows/screenshot-window';
import { pixelArea } from './screenshot-geometry';
import type { Area } from './screenshot-geometry';
import { screenshotFileName } from './screenshot-geometry';

// Longer than the donut's fade out, so it is fully gone from the picture.
const STEP_ASIDE_MS = 250;

const FOLDER_NAME = 'Pie Launcher';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureDisplay(display: Display): Promise<NativeImage> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    },
  });
  const source =
    sources.find(({ display_id }) => display_id === String(display.id)) ??
    (sources.length === 1 ? sources[0] : undefined);
  if (!source || source.thumbnail.isEmpty()) {
    throw new UserError('Could not capture the screen.');
  }
  return source.thumbnail;
}

export const SAVED_TO = `Pictures\\${FOLDER_NAME}`;

// Writes the picture to Pictures\Pie Launcher, with a notice that shows the
// file when clicked.
export async function saveToPictures(
  bytes: Uint8Array,
  fileName: string,
  notice: { title: string; body: string },
): Promise<void> {
  const folder = path.join(app.getPath('pictures'), FOLDER_NAME);
  const file = path.join(folder, fileName);
  await mkdir(folder, { recursive: true });
  await writeFile(file, bytes);

  if (Notification.isSupported()) {
    const shown = new Notification({ ...notice, silent: true });
    shown.on('click', () => shell.showItemInFolder(file));
    shown.show();
  }
}

async function saveScreenshot(image: NativeImage): Promise<void> {
  await copyPicture(image);
  await saveToPictures(image.toPNG(), screenshotFileName(new Date()), {
    title: 'Screenshot copied',
    body: `Also saved to ${SAVED_TO}. Click to show it.`,
  });
}

export async function takeScreenshot(mode: ScreenshotMode): Promise<void> {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  // A pinned donut comes back afterwards, as the person left it.
  const comesBack = isPieWindowOpen() && isPiePinned();
  hidePieWindow();
  await wait(STEP_ASIDE_MS);

  let image: NativeImage;
  try {
    image = await captureDisplay(display);
  } catch (error) {
    if (comesBack) showPieWindowInPlace();
    throw error;
  }

  if (mode === 'screen') {
    try {
      await saveScreenshot(image);
    } finally {
      if (comesBack) showPieWindowInPlace();
    }
    return;
  }

  openSectionPicker(image, display, async (selection: Area | null) => {
    try {
      const area = selection
        ? pixelArea(selection, display.scaleFactor, image.getSize())
        : null;
      if (area) {
        await saveScreenshot(image.crop(area));
      }
    } catch (error) {
      // The donut that asked is gone by now, so there's no one to tell.
      console.error('Could not save the screenshot.', error);
    } finally {
      if (comesBack) showPieWindowInPlace();
    }
  });
}
