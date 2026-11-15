import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import type { SavedSiteService } from '../services/saved-site.service';
import { saveToPictures } from '../screenshot/screenshot';
import { copyPicture } from '../screenshot/picture';
import {
  checkInPageInfo,
  getPageInfoController,
} from '../windows/page-info-window';
import { openSavedSitesWindow } from '../windows/saved-sites-window';
import { eventFor } from './fake-sender';
import { registerSavedSitesIpc } from './saved-sites.ipc';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  nativeImage: { createFromBuffer: vi.fn(() => ({ picture: true })) },
}));
vi.mock('../screenshot/screenshot', () => ({
  SAVED_TO: 'Pictures\\Pie Launcher',
  saveToPictures: vi.fn(async () => undefined),
}));
vi.mock('../screenshot/picture', async (original) => ({
  ...(await original<typeof import('../screenshot/picture')>()),
  copyPicture: vi.fn(async () => undefined),
}));
vi.mock('../windows/page-info-window', () => ({
  checkInPageInfo: vi.fn(),
  focusPageInfoWindow: vi.fn(),
  getPageInfoController: vi.fn(),
}));
vi.mock('../windows/saved-sites-window', () => ({
  openSavedSitesWindow: vi.fn(),
}));

const ID = '8b2f6a52-5c4e-4b8e-9f1a-3d2c1b0a9e8f';
const REPORT = { url: 'https://a.com/' };
const savedSites = {
  save: vi.fn(async () => ({ status: 'saved' })),
  list: vi.fn(() => []),
  get: vi.fn(() => ({ id: ID, address: 'https://a.com/', title: 'Shop' })),
  find: vi.fn(() => ({ id: ID, address: 'https://a.com/', title: 'Shop' })),
  setNote: vi.fn(),
  remove: vi.fn(async () => undefined),
  screenshot: vi.fn(async (): Promise<Buffer | null> => Buffer.from('jpeg')),
};

function call(channel: string, ...args: unknown[]) {
  const found = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!found) throw new Error(`${channel} handler was not registered`);
  const run = found[1] as (event: unknown, ...rest: unknown[]) => unknown;
  return run(eventFor(channel), ...args) as Promise<{
    ok: boolean;
    value?: unknown;
    error?: string;
  }>;
}

beforeEach(() => {
  vi.clearAllMocks();
  registerSavedSitesIpc(savedSites as unknown as SavedSiteService);
});

describe('saving from Page Info', () => {
  it('saves the active tab’s results and its screenshot', async () => {
    vi.mocked(getPageInfoController).mockReturnValue({
      state: () => ({ report: REPORT }),
      capturedImage: () => ({ dataUrl: 'data:image/jpeg;base64,AAAA' }),
    } as never);
    await call(IpcChannels.savedSitesSave, false);
    expect(savedSites.save).toHaveBeenCalledWith(
      { report: REPORT, jpeg: Buffer.from('AAAA', 'base64') },
      false,
    );
  });

  it('asks for a check first when the tab has no results', async () => {
    vi.mocked(getPageInfoController).mockReturnValue({
      state: () => ({ report: null }),
    } as never);
    await expect(call(IpcChannels.savedSitesSave, true)).resolves.toEqual({
      ok: false,
      error: 'Check a page first, then save it.',
    });
    expect(savedSites.save).not.toHaveBeenCalled();
  });

  it('opens the Saved sites window', async () => {
    await call(IpcChannels.savedSitesOpenWindow);
    expect(openSavedSitesWindow).toHaveBeenCalledOnce();
  });
});

describe('the saved list', () => {
  it('refuses an id that is not one', async () => {
    await expect(call(IpcChannels.savedSitesGet, '../x')).rejects.toThrow();
    expect(savedSites.get).not.toHaveBeenCalled();
  });

  it('saves a note', async () => {
    await call(IpcChannels.savedSitesSetNote, ID, 'Check GA4');
    expect(savedSites.setNote).toHaveBeenCalledWith(ID, 'Check GA4');
  });

  it('checks a saved site live in Page Info', async () => {
    await call(IpcChannels.savedSitesOpenLive, ID);
    expect(checkInPageInfo).toHaveBeenCalledWith('https://a.com/');
  });

  it('gives the saved picture as a data address', async () => {
    await expect(call(IpcChannels.savedSitesScreenshot, ID)).resolves.toEqual({
      ok: true,
      value: `data:image/jpeg;base64,${Buffer.from('jpeg').toString('base64')}`,
    });
  });

  it('saves and copies the saved picture', async () => {
    await call(IpcChannels.savedSitesSaveScreenshot, ID);
    expect(vi.mocked(saveToPictures).mock.calls[0][1]).toMatch(/^Shop /);
    await call(IpcChannels.savedSitesCopyScreenshot, ID);
    expect(copyPicture).toHaveBeenCalledWith({ picture: true });
  });

  it('says when there is no picture to save', async () => {
    savedSites.screenshot.mockResolvedValueOnce(null);
    await expect(
      call(IpcChannels.savedSitesSaveScreenshot, ID),
    ).resolves.toEqual({
      ok: false,
      error: 'This saved site has no screenshot.',
    });
  });
});
