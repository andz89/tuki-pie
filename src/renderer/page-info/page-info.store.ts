import { create } from 'zustand';
import type { LinkFilter } from '../../shared/link-rules';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import { DESKTOP } from '../../shared/devices';
import type {
  CaptureSize,
  PageInfoUpdate,
  PageScreenshot,
  Settings,
} from '../../shared/types';
import { pageInfoBridge } from './page-info-bridge';

// The Screenshot tab. Only the button takes one, never opening the tab.
export interface ScreenshotState {
  status: 'none' | 'taking' | 'done';
  shot: PageScreenshot | null;
  problem: string | null;
  // What Save or Copy just did, shown under the buttons.
  notice: string | null;
}

export const NO_SCREENSHOT: ScreenshotState = {
  status: 'none',
  shot: null,
  problem: null,
  notice: null,
};

// A new check, a refresh, or another page: the picture no longer matches.
const pageChanged = (before: PageInfoUpdate, after: PageInfoUpdate) =>
  after.report === null || after.address !== before.address;

interface PageInfoState {
  update: PageInfoUpdate;
  problem: string | null;
  settings: Settings;
  start: () => Promise<void>;
  loadSettings: () => Promise<void>;
  check: (address: string) => Promise<void>;
  refresh: () => Promise<void>;
  toggleSite: () => Promise<void>;
  goToTab: () => Promise<void>;
  toggleOnTop: () => Promise<void>;
  setLinkFilter: (filter: LinkFilter) => Promise<void>;
  screenshot: ScreenshotState;
  // Kept across pages, like the choice in a menu.
  captureSize: CaptureSize;
  setCaptureSize: (changes: Partial<CaptureSize>) => void;
  takeScreenshot: () => Promise<void>;
  saveScreenshot: () => Promise<void>;
  copyScreenshot: () => Promise<void>;
}

// One listener at a time, even when React runs the start-up effect twice.
let stopListening: (() => void) | undefined;

export const usePageInfoStore = create<PageInfoState>()((set, get) => ({
  update: {
    status: 'idle',
    address: null,
    report: null,
    message: null,
    siteVisible: false,
    chromeConnected: false,
  },
  problem: null,
  settings: DEFAULT_SETTINGS,
  screenshot: NO_SCREENSHOT,
  captureSize: { device: DESKTOP, reload: false },

  setCaptureSize: (changes) =>
    set({ captureSize: { ...get().captureSize, ...changes } }),

  start: async () => {
    stopListening?.();
    const receive = (update: PageInfoUpdate) =>
      set((state) => ({
        update,
        screenshot: pageChanged(state.update, update)
          ? NO_SCREENSHOT
          : state.screenshot,
      }));
    stopListening = pageInfoBridge.onUpdate(receive);
    const result = await pageInfoBridge.getState();
    if (result.ok) {
      receive(result.value);
    }
  },

  loadSettings: async () => {
    const result = await pageInfoBridge.settings.get();
    if (result.ok) {
      set({ settings: result.value });
    }
  },

  check: async (address) => {
    const result = await pageInfoBridge.check(address);
    set({ problem: result.ok ? null : result.error });
  },

  refresh: async () => {
    await pageInfoBridge.refresh();
  },

  toggleSite: async () => {
    await pageInfoBridge.setSiteVisible(!get().update.siteVisible);
  },

  goToTab: async () => {
    await pageInfoBridge.goToTab();
  },

  toggleOnTop: async () => {
    const onTop = get().settings.pageInfoOnTop === 'on-top';
    const result = await pageInfoBridge.setOnTop(!onTop);
    if (result.ok) {
      set({ settings: result.value });
    }
  },

  // Shown at once; the saved settings come back from the main process.
  setLinkFilter: async (filter) => {
    set({
      settings: { ...get().settings, linkFilter: JSON.stringify(filter) },
    });
    const result = await pageInfoBridge.setLinkFilter(filter);
    if (result.ok) {
      set({ settings: result.value });
    }
  },

  takeScreenshot: async () => {
    if (get().screenshot.status === 'taking') {
      return;
    }
    const before = get().screenshot;
    set({
      screenshot: { ...before, status: 'taking', problem: null, notice: null },
    });
    const result = await pageInfoBridge.capture(get().captureSize);
    set({
      screenshot: result.ok
        ? { status: 'done', shot: result.value, problem: null, notice: null }
        : {
            ...before,
            status: before.shot ? 'done' : 'none',
            problem: result.error,
            notice: null,
          },
    });
  },

  saveScreenshot: async () => {
    const result = await pageInfoBridge.saveCapture();
    set({
      screenshot: {
        ...get().screenshot,
        problem: result.ok ? null : result.error,
        notice: result.ok ? 'Saved to Pictures\\Pie Launcher.' : null,
      },
    });
  },

  copyScreenshot: async () => {
    const result = await pageInfoBridge.copyCapture();
    set({
      screenshot: {
        ...get().screenshot,
        problem: result.ok ? null : result.error,
        notice: result.ok ? 'Copied.' : null,
      },
    });
  },
}));
