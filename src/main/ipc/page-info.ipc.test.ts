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
import { eventFor } from './fake-sender';

const thumb = {
  resize: vi.fn(() => thumb),
  toJPEG: vi.fn(() => Buffer.from('thumb')),
};
const image = {
  isEmpty: () => false,
  getSize: () => ({ width: 1280, height: 9000 }),
  toPNG: () => new Uint8Array([1]),
  crop: vi.fn(() => thumb),
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
  section: '',
  matches: null,
};
const SIZE = { device: 'iPhone 16', reload: false, section: '' };
const controller = {
  openLinks: vi.fn(() => true),
  capture: vi.fn(async () => SHOT),
  capturedImage: vi.fn((): typeof SHOT | null => SHOT),
  state: () => ({ report: { meta: { title: 'Shop' } } }),
};
const images = { get: vi.fn(async () => null) };
const siteTabs = {
  add: vi.fn(),
  close: vi.fn(),
  switchTo: vi.fn(),
  list: vi.fn(() => ({ tabs: [], activeId: '1' })),
};
vi.mock('../windows/page-info-window', () => ({
  focusPageInfoWindow: vi.fn(),
  getPageInfoController: vi.fn(() => controller),
  getPageInfoTabs: vi.fn(() => siteTabs),
  getPageInfoImages: vi.fn(() => images),
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
    await handlerFor(IpcChannels.pageInfoOpenLinks)(
      eventFor(IpcChannels.pageInfoOpenLinks),
      LINKS,
      [],
    );
    expect(controller.openLinks).toHaveBeenCalledWith(['https://a.com/about']);
    expect(getPageInfoController).toHaveBeenCalled();
  });

  it('opens what the user switched off', async () => {
    linkFilter = JSON.stringify({
      off: ['action:delete'],
      words: [],
      tokens: false,
    });
    await handlerFor(IpcChannels.pageInfoOpenLinks)(
      eventFor(IpcChannels.pageInfoOpenLinks),
      LINKS,
      [],
    );
    expect(controller.openLinks).toHaveBeenCalledWith(LINKS);
  });

  it('opens a marked link only when the user ticked it', async () => {
    await handlerFor(IpcChannels.pageInfoOpenLinks)(
      eventFor(IpcChannels.pageInfoOpenLinks),
      LINKS,
      ['https://a.com/order?id=5', 'https://a.com/posts/5/delete'],
    );
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
    await handlerFor(IpcChannels.pageInfoOpenLinks)(
      eventFor(IpcChannels.pageInfoOpenLinks),
      LINKS,
      [],
    );
    expect(controller.openLinks).toHaveBeenCalledWith([]);
  });
});

describe('saving Link filters', () => {
  it('saves the filter as text', async () => {
    const filter = { off: ['nonce'], words: [], tokens: true };
    await handlerFor(IpcChannels.pageInfoSetLinkFilter)(
      eventFor(IpcChannels.pageInfoSetLinkFilter),
      filter,
    );
    expect(settings.update).toHaveBeenCalledExactlyOnceWith({
      linkFilter: JSON.stringify(filter),
    });
  });

  it('refuses a filter that is not one', async () => {
    await expect(
      handlerFor(IpcChannels.pageInfoSetLinkFilter)(
        eventFor(IpcChannels.pageInfoSetLinkFilter),
        { off: 'x' },
      ),
    ).rejects.toThrow();
    expect(settings.update).not.toHaveBeenCalled();
  });
});

describe('page images', () => {
  it('asks the active tab for its picture', async () => {
    await handlerFor(IpcChannels.pageInfoImage)(
      eventFor(IpcChannels.pageInfoImage),
      'https://a.com/x.png',
      'thumb',
    );
    expect(images.get).toHaveBeenCalledWith('https://a.com/x.png', 'thumb');
  });

  it('takes only a small or a full picture', async () => {
    await expect(
      handlerFor(IpcChannels.pageInfoImage)(
        eventFor(IpcChannels.pageInfoImage),
        'https://a.com/x.png',
        'huge',
      ),
    ).rejects.toThrow();
  });
});

describe('the page screenshot', () => {
  it('sends the picture with its size', async () => {
    await expect(
      handlerFor(IpcChannels.pageInfoCapture)(
        eventFor(IpcChannels.pageInfoCapture),
        SIZE,
      ),
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
        section: '',
        matches: null,
        thumbDataUrl: `data:image/jpeg;base64,${Buffer.from('thumb').toString('base64')}`,
      },
    });
    expect(controller.capture).toHaveBeenCalledWith(SIZE);
    expect(focusPageInfoWindow).toHaveBeenCalled();
  });

  it('makes a small picture of the top of the page for the dashboard', async () => {
    await handlerFor(IpcChannels.pageInfoCapture)(
      eventFor(IpcChannels.pageInfoCapture),
      SIZE,
    );
    expect(image.crop).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 1280,
      height: 960,
    });
    expect(thumb.resize).toHaveBeenCalledWith({ width: 480 });
  });

  it('refuses a size that is not on the list', async () => {
    await expect(
      handlerFor(IpcChannels.pageInfoCapture)(
        eventFor(IpcChannels.pageInfoCapture),
        { device: 'Huge', reload: false, section: '' },
      ),
    ).rejects.toThrow();
    expect(controller.capture).not.toHaveBeenCalled();
  });

  it('refuses a section selector longer than the limit', async () => {
    await expect(
      handlerFor(IpcChannels.pageInfoCapture)(
        eventFor(IpcChannels.pageInfoCapture),
        { ...SIZE, section: 'a'.repeat(501) },
      ),
    ).rejects.toThrow();
    expect(controller.capture).not.toHaveBeenCalled();
  });

  it('comes back to the window even when it fails', async () => {
    controller.capture.mockRejectedValueOnce(new Error('boom'));
    await expect(
      handlerFor(IpcChannels.pageInfoCapture)(
        eventFor(IpcChannels.pageInfoCapture),
        SIZE,
      ),
    ).rejects.toThrow();
    expect(focusPageInfoWindow).toHaveBeenCalled();
  });

  it('saves the kept JPEG under the page title', async () => {
    await handlerFor(IpcChannels.pageInfoSaveCapture)(
      eventFor(IpcChannels.pageInfoSaveCapture),
    );
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
      await expect(handlerFor(channel)(eventFor(channel))).resolves.toEqual({
        ok: false,
        error: 'Take a screenshot first.',
      });
    }
    controller.capturedImage.mockReturnValue(SHOT);
  });
});

describe('site tabs', () => {
  const call = (channel: string, ...args: unknown[]) =>
    handlerFor(channel)(eventFor(channel), ...args);

  it('opens an empty tab', async () => {
    await call(IpcChannels.pageInfoNewTab, null, false);
    expect(siteTabs.add).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('checks a link opened in a new tab there', async () => {
    await call(IpcChannels.pageInfoNewTab, 'https://a.com/x', false);
    expect(siteTabs.add).toHaveBeenCalledExactlyOnceWith('https://a.com/x');
  });

  it('passes on why a new tab was refused', async () => {
    siteTabs.add.mockImplementationOnce(() => {
      throw new Error('Chrome not connected.');
    });
    await expect(
      call(IpcChannels.pageInfoNewTab, 'https://a.com/x', false),
    ).rejects.toThrow('Chrome not connected.');
  });

  it('never opens a link the saved Link filters hide', async () => {
    await expect(
      call(IpcChannels.pageInfoNewTab, 'https://a.com/posts/5/delete', false),
    ).resolves.toMatchObject({ ok: false });
    expect(siteTabs.add).not.toHaveBeenCalled();
  });

  it('closes and switches by id', async () => {
    await call(IpcChannels.pageInfoCloseTab, '2');
    await call(IpcChannels.pageInfoSwitchTab, '3');
    expect(siteTabs.close).toHaveBeenCalledWith('2');
    expect(siteTabs.switchTo).toHaveBeenCalledWith('3');
  });

  it('refuses an id that is not text', async () => {
    await expect(call(IpcChannels.pageInfoCloseTab, 5)).rejects.toThrow();
    expect(siteTabs.close).not.toHaveBeenCalled();
  });
});
