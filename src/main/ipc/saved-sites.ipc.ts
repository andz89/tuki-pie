import { nativeImage } from 'electron';
import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import {
  SavedSiteId,
  SavedSiteNote,
} from '../../shared/schemas/saved-site.schema';
import { SAVED_TO, saveToPictures } from '../screenshot/screenshot';
import { copyPicture, jpegBytes } from '../screenshot/picture';
import { pageScreenshotFileName } from '../screenshot/screenshot-geometry';
import type { SavedSiteService } from '../services/saved-site.service';
import { UserError } from '../services/user-error';
import {
  checkInPageInfo,
  focusPageInfoWindow,
  getPageInfoController,
} from '../windows/page-info-window';
import { openSavedSitesWindow } from '../windows/saved-sites-window';
import { handle } from './handle';

const NOTHING_TO_SAVE = 'Check a page first, then save it.';
const NO_SCREENSHOT = 'This saved site has no screenshot.';

export function registerSavedSitesIpc(savedSites: SavedSiteService): void {
  const id = z.tuple([SavedSiteId]);

  // The results and the picture come from the active Page Info tab in main,
  // so no window ever hands over what gets stored.
  handle(IpcChannels.savedSitesSave, z.tuple([z.boolean()]), (replace) => {
    const controller = getPageInfoController();
    const report = controller?.state().report;
    if (!controller || !report) {
      throw new UserError(NOTHING_TO_SAVE);
    }
    const shot = controller.capturedImage();
    return savedSites.save(
      { report, jpeg: shot ? jpegBytes(shot.dataUrl) : null },
      replace,
    );
  });

  handle(IpcChannels.savedSitesOpenWindow, z.tuple([]), () =>
    openSavedSitesWindow(),
  );

  handle(IpcChannels.savedSitesList, z.tuple([]), () => savedSites.list());

  handle(IpcChannels.savedSitesGet, id, (siteId) => savedSites.get(siteId));

  handle(
    IpcChannels.savedSitesSetNote,
    z.tuple([SavedSiteId, SavedSiteNote]),
    (siteId, note) => savedSites.setNote(siteId, note),
  );

  handle(IpcChannels.savedSitesRemove, id, (siteId) =>
    savedSites.remove(siteId),
  );

  handle(IpcChannels.savedSitesOpenLive, id, (siteId) => {
    checkInPageInfo(savedSites.find(siteId).address);
    focusPageInfoWindow();
  });

  handle(IpcChannels.savedSitesScreenshot, id, async (siteId) => {
    const jpeg = await savedSites.screenshot(siteId);
    return jpeg ? `data:image/jpeg;base64,${jpeg.toString('base64')}` : null;
  });

  const savedPicture = async (siteId: string) => {
    const jpeg = await savedSites.screenshot(siteId);
    if (!jpeg) {
      throw new UserError(NO_SCREENSHOT);
    }
    return jpeg;
  };

  handle(IpcChannels.savedSitesSaveScreenshot, id, async (siteId) => {
    const jpeg = await savedPicture(siteId);
    await saveToPictures(
      jpeg,
      pageScreenshotFileName(savedSites.find(siteId).title, new Date()),
      {
        title: 'Screenshot saved',
        body: `Saved to ${SAVED_TO}. Click to show it.`,
      },
    );
  });

  handle(IpcChannels.savedSitesCopyScreenshot, id, async (siteId) => {
    await copyPicture(nativeImage.createFromBuffer(await savedPicture(siteId)));
  });
}
