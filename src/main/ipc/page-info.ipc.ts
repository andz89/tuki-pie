import { ClipboardItem, clipboard, nativeImage } from 'electron';
import { z } from 'zod';
import { DESKTOP, DEVICE_NAMES } from '../../shared/devices';
import { IpcChannels } from '../../shared/ipc-channels';
import { LinkFilter, canOpen, readLinkFilter } from '../../shared/link-rules';
import {
  MAX_PAGE_LIST,
  MAX_PAGE_URL,
} from '../../shared/schemas/page-info.schema';
import { MAX_OPEN_LINKS } from '../../shared/types';
import type { PageInfoUpdate, PageScreenshot } from '../../shared/types';
import { SAVED_TO, saveToPictures } from '../screenshot/screenshot';
import { pageScreenshotFileName } from '../screenshot/screenshot-geometry';
import { UserError } from '../services/user-error';
import type { SettingsService } from '../services/settings.service';
import {
  focusPageInfoWindow,
  getPageInfoController,
  goToChromeTab,
  setPageInfoOnTop,
} from '../windows/page-info-window';
import { handle } from './handle';

const NO_SCREENSHOT = 'Take a screenshot first.';
const COULD_NOT_CAPTURE = 'Could not take the screenshot.';

// The JPEG itself, from the base64 after the comma.
const jpegBytes = (dataUrl: string) =>
  Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

function keptScreenshot() {
  const controller = getPageInfoController();
  const shot = controller?.capturedImage();
  if (!controller || !shot) {
    throw new UserError(NO_SCREENSHOT);
  }
  return { controller, shot };
}

const NOTHING_LOADED: PageInfoUpdate = {
  status: 'idle',
  address: null,
  report: null,
  message: null,
  siteVisible: false,
  chromeConnected: false,
  reportId: 0,
};

export function registerPageInfoIpc(settings: SettingsService): void {
  handle(
    IpcChannels.pageInfoGetState,
    z.tuple([]),
    () => getPageInfoController()?.state() ?? NOTHING_LOADED,
  );

  handle(
    IpcChannels.pageInfoCheck,
    z.tuple([z.string().max(MAX_PAGE_URL)]),
    (address) => getPageInfoController()?.check(address),
  );

  handle(IpcChannels.pageInfoGoToTab, z.tuple([]), () => goToChromeTab());

  handle(
    IpcChannels.pageInfoCapture,
    z.tuple([
      z.object({
        device: z.enum([DESKTOP, ...DEVICE_NAMES]),
        reload: z.boolean(),
      }),
    ]),
    async (size): Promise<PageScreenshot> => {
      const controller = getPageInfoController();
      if (!controller) {
        throw new UserError(COULD_NOT_CAPTURE);
      }
      try {
        const shot = await controller.capture(size);
        const image = nativeImage.createFromDataURL(shot.dataUrl);
        if (image.isEmpty()) {
          throw new UserError(COULD_NOT_CAPTURE);
        }
        return {
          ...image.getSize(),
          dataUrl: shot.dataUrl,
          bytes: jpegBytes(shot.dataUrl).length,
          stitched: shot.stitched,
          stitchReason: shot.stitchReason,
          device: shot.device,
        };
      } finally {
        focusPageInfoWindow();
      }
    },
  );

  handle(IpcChannels.pageInfoSaveCapture, z.tuple([]), async () => {
    const { controller, shot } = keptScreenshot();
    const title = controller.state().report?.meta.title ?? '';
    await saveToPictures(
      jpegBytes(shot.dataUrl),
      pageScreenshotFileName(title, new Date(), shot.device),
      {
        title: 'Screenshot saved',
        body: `Saved to ${SAVED_TO}. Click to show it.`,
      },
    );
  });

  // As PNG, which every app accepts from the clipboard.
  handle(IpcChannels.pageInfoCopyCapture, z.tuple([]), async () => {
    const { shot } = keptScreenshot();
    const png = nativeImage.createFromDataURL(shot.dataUrl).toPNG();
    await clipboard.write([
      new ClipboardItem({
        'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }),
      }),
    ]);
  });

  handle(
    IpcChannels.pageInfoShowLink,
    z.tuple([
      z.number().int().min(0).max(MAX_PAGE_LIST),
      z.string().max(MAX_PAGE_URL),
    ]),
    async (index, href) =>
      (await getPageInfoController()?.showLink(index, href)) ?? null,
  );

  handle(
    IpcChannels.pageInfoOpenLinks,
    z.tuple([
      z.array(z.string().max(MAX_PAGE_URL)).max(MAX_OPEN_LINKS),
      z.array(z.string().max(MAX_PAGE_URL)).max(MAX_OPEN_LINKS),
    ]),
    (urls, ticked) => {
      // The saved Link filters decide, whatever the window asks for. A link
      // marked as carrying a token opens only when the user ticked it.
      const filter = readLinkFilter(settings.get().linkFilter);
      const tickedSet = new Set(ticked);
      const allowed = urls.filter((url) =>
        canOpen(url, filter, tickedSet.has(url)),
      );
      return getPageInfoController()?.openLinks(allowed) ?? false;
    },
  );

  handle(IpcChannels.pageInfoSetLinkFilter, z.tuple([LinkFilter]), (filter) =>
    settings.update({ linkFilter: JSON.stringify(filter) }),
  );

  handle(IpcChannels.pageInfoSetOnTop, z.tuple([z.boolean()]), (onTop) => {
    const saved = settings.update({
      pageInfoOnTop: onTop ? 'on-top' : 'normal',
    });
    setPageInfoOnTop(saved.pageInfoOnTop);
    return saved;
  });

  handle(IpcChannels.pageInfoRefresh, z.tuple([]), () =>
    getPageInfoController()?.refresh(),
  );

  handle(
    IpcChannels.pageInfoSetSiteVisible,
    z.tuple([z.boolean()]),
    (visible) => getPageInfoController()?.setSiteVisible(visible),
  );
}
