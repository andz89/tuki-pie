import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannels } from '../../shared/ipc-channels';
import { DEFAULT_LINK_FILTER } from '../../shared/link-rules';
import type { SettingsService } from '../services/settings.service';
import { saveToPictures } from '../screenshot/screenshot';
import {
  focusPageInfoWindow,
  getPageInfoController,
} from '../windows/page-info-window';
import { registerPageInfoIpc } from './page-info.ipc';

const image = {
  isEmpty: () => false,
  getSize: () => ({ width: 1280, height: 9000 }),
  toPNG: () => new Uint8Array([1]),
};
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  nativeImage: { createFromDataURL: vi.fn(() => image) },
  clipboard: { write: vi.fn(async () => undefined) },
  ClipboardItem: class {},
}));
const SHOT = {
  dataUrl: 'data:image/jpeg;base64,AAAA',
  stitched: false,
  stitchReason: null,
  device: 'iPhone 16',
};
const SIZE = { device: 'iPhone 16', reload: false };
const controller = {
  openLinks: vi.fn(() => true),
  capture: vi.fn(async () => SHOT),
  capturedImage: vi.fn((): typeof SHOT | null => SHOT),
  state: () => ({ report: { meta: { title: 'Shop' } } }),
};
vi.mock('../windows/page-info-window', () => ({
  focusPageInfoWindow: vi.fn(),
  getPageInfoController: vi.fn(() => controller),
  goToChromeTab: vi.fn(),
  setPageInfoOnTop: vi.fn(),
}));
vi.mock('../screenshot/screenshot', () => ({
  SAVED_TO: 'Pictures\\Pie Launcher',
  saveToPictures: vi.fn(async () => undefined),
}));

let linkFilter = JSON.stringify(DEFAULT_LINK_FILTER);
const settings = {
  get: vi.fn(() => ({ linkFilter })),
  update: vi.fn((changes: { linkFilter: string }) => changes),
};

function handlerFor(channel: string) {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`${channel} handler was not registered`);
  return call[1] as (event: unknown, ...args: unknown[]) => Promise<unknown>;
}

const LINKS = [
  'https://a.com/about',
  'https://a.com/posts/5/delete',
  'https://a.com/order?id=5',
];

beforeEach(() => {
  vi.clearAllMocks();
  linkFilter = JSON.stringify(DEFAULT_LINK_FILTER);
  registerPageInfoIpc(settings as unknown as SettingsService);
});

describe('opening links', () => {
  it('never opens what the saved Link filters hide or mark', async () => {
    await handlerFor(IpcChannels.pageInfoOpenLinks)({}, LINKS, []);
    expect(controller.openLinks).toHaveBeenCalledWith(['https://a.com/about']);
    expect(getPageInfoController).toHaveBeenCalled();
  });

  it('opens what the user switched off', async () => {
    linkFilter = JSON.stringify({
      off: ['action:delete'],
      words: [],
      tokens: false,
    });
    await handlerFor(IpcChannels.pageInfoOpenLinks)({}, LINKS, []);
    expect(controller.openLinks).toHaveBeenCalledWith(LINKS);
  });

  it('opens a marked link only when the user ticked it', async () => {
    await handlerFor(IpcChannels.pageInfoOpenLinks)({}, LINKS, [
      'https://a.com/order?id=5',
      'https://a.com/posts/5/delete',
    ]);
    expect(controller.openLinks).toHaveBeenCalledWith([
      'https://a.com/about',
      'https://a.com/order?id=5',
    ]);
  });

  it('respects your own words', async () => {
    linkFilter = JSON.stringify({
      ...DEFAULT_LINK_FILTER,
      words: [{ word: 'about', on: true }],
    });
    await handlerFor(IpcChannels.pageInfoOpenLinks)({}, LINKS, []);
    expect(controller.openLinks).toHaveBeenCalledWith([]);
  });
});

describe('saving Link filters', () => {
  it('saves the filter as text', async () => {
    const filter = { off: ['nonce'], words: [], tokens: true };
    await handlerFor(IpcChannels.pageInfoSetLinkFilter)({}, filter);
    expect(settings.update).toHaveBeenCalledExactlyOnceWith({
      linkFilter: JSON.stringify(filter),
    });
  });

  it('refuses a filter that is not one', async () => {
    await expect(
      handlerFor(IpcChannels.pageInfoSetLinkFilter)({}, { off: 'x' }),
    ).rejects.toThrow();
    expect(settings.update).not.toHaveBeenCalled();
  });
});

describe('the page screenshot', () => {
  it('sends the picture with its size', async () => {
    await expect(
      handlerFor(IpcChannels.pageInfoCapture)({}, SIZE),
    ).resolves.toEqual({
      ok: true,
      value: {
        dataUrl: SHOT.dataUrl,
        width: 1280,
        height: 9000,
        bytes: 3,
        stitched: false,
        stitchReason: null,
        device: 'iPhone 16',
      },
    });
    expect(controller.capture).toHaveBeenCalledWith(SIZE);
    expect(focusPageInfoWindow).toHaveBeenCalled();
  });

  it('refuses a size that is not on the list', async () => {
    await expect(
      handlerFor(IpcChannels.pageInfoCapture)(
        {},
        { device: 'Huge', reload: false },
      ),
    ).rejects.toThrow();
    expect(controller.capture).not.toHaveBeenCalled();
  });

  it('comes back to the window even when it fails', async () => {
    controller.capture.mockRejectedValueOnce(new Error('boom'));
    await expect(
      handlerFor(IpcChannels.pageInfoCapture)({}, SIZE),
    ).rejects.toThrow();
    expect(focusPageInfoWindow).toHaveBeenCalled();
  });

  it('saves the kept JPEG under the page title', async () => {
    await handlerFor(IpcChannels.pageInfoSaveCapture)({});
    const [bytes, name] = vi.mocked(saveToPictures).mock.calls[0];
    expect(Buffer.from(bytes).toString('base64')).toBe('AAAA');
    expect(name).toMatch(/^Shop iPhone 16 \d{4}-\d{2}-\d{2} \d{6}\.jpg$/);
  });

  it('asks for a screenshot before saving or copying', async () => {
    controller.capturedImage.mockReturnValue(null);
    for (const channel of [
      IpcChannels.pageInfoSaveCapture,
      IpcChannels.pageInfoCopyCapture,
    ]) {
      await expect(handlerFor(channel)({})).resolves.toEqual({
        ok: false,
        error: 'Take a screenshot first.',
      });
    }
    controller.capturedImage.mockReturnValue(SHOT);
  });
});
