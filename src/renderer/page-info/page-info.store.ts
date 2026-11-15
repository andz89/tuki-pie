import { create } from 'zustand';
import type { LinkFilter } from '../../shared/link-rules';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import { DESKTOP } from '../../shared/devices';
import { sectionSelector } from '../../shared/section-selector';
import type { SectionKind } from '../../shared/section-selector';
import type {
  CaptureSize,
  PageInfoUpdate,
  PageScreenshot,
  SavedSiteSummary,
  Settings,
  SiteTabList,
} from '../../shared/types';
import { blobUrlFromDataUrl } from './blob-url';
import { pageInfoBridge } from './page-info-bridge';

// What the window keeps of a screenshot. The full picture can be tens of
// megabytes as a data: address; one blob address serves every <img> instead.
export type ShownScreenshot = Omit<PageScreenshot, 'dataUrl'> & {
  imageUrl: string;
};

function shownScreenshot({
  dataUrl,
  ...rest
}: PageScreenshot): ShownScreenshot {
  return { ...rest, imageUrl: blobUrlFromDataUrl(dataUrl) };
}

// The Screenshot tab. Only the button takes one, never opening the tab.
export interface ScreenshotState {
  status: 'none' | 'taking' | 'done';
  shot: ShownScreenshot | null;
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

// A new check, a refresh, or another page in the same tab: the picture no
// longer matches.
const pageChanged = (before: PageInfoUpdate, after: PageInfoUpdate) =>
  after.report === null || after.address !== before.address;

// Every picture the window holds, so the ones no longer held give their
// memory back.
const imageUrls = (state: {
  screenshot: ScreenshotState;
  otherScreenshots: Record<string, ScreenshotState>;
}) =>
  new Set(
    [state.screenshot, ...Object.values(state.otherScreenshots)].flatMap(
      ({ shot }) => (shot ? [shot.imageUrl] : []),
    ),
  );

interface PageInfoState {
  // The active tab's state.
  update: PageInfoUpdate;
  tabs: SiteTabList;
  // ticked: the address is marked as carrying a token, and you ticked it.
  newTab: (address: string | null, ticked?: boolean) => Promise<void>;
  closeTab: (id: string) => Promise<void>;
  switchTab: (id: string) => Promise<void>;
  problem: string | null;
  // Save: the saved site it would replace, while you decide; and what it did.
  saveQuestion: SavedSiteSummary | null;
  saveNotice: string | null;
  isSaving: boolean;
  saveSite: (replace: boolean) => Promise<void>;
  cancelSave: () => void;
  openSavedSitesWindow: () => Promise<void>;
  settings: Settings;
  start: () => Promise<void>;
  loadSettings: () => Promise<void>;
  check: (address: string) => Promise<void>;
  refresh: () => Promise<void>;
  toggleSite: () => Promise<void>;
  goToTab: () => Promise<void>;
  toggleOnTop: () => Promise<void>;
  setLinkFilter: (filter: LinkFilter) => Promise<void>;
  // The active tab's screenshot, and the other tabs' by tab id.
  screenshot: ScreenshotState;
  otherScreenshots: Record<string, ScreenshotState>;
  // Kept across pages, like the choice in a menu. section is the text as
  // typed; sectionKind says how it is read.
  captureSize: CaptureSize;
  setCaptureSize: (changes: Partial<CaptureSize>) => void;
  sectionKind: SectionKind;
  setSectionKind: (kind: SectionKind) => void;
  takeScreenshot: () => Promise<void>;
  saveScreenshot: () => Promise<void>;
  copyScreenshot: () => Promise<void>;
}

// One listener at a time, even when React runs the start-up effect twice.
let stopListening: (() => void) | undefined;
let stopListeningToTabs: (() => void) | undefined;

export const usePageInfoStore = create<PageInfoState>()((set, get) => ({
  update: {
    tabId: '',
    status: 'idle',
    address: null,
    report: null,
    message: null,
    siteVisible: false,
    chromeConnected: false,
    reportId: 0,
  },
  tabs: { tabs: [], activeId: '' },
  problem: null,
  saveQuestion: null,
  saveNotice: null,
  isSaving: false,

  saveSite: async (replace) => {
    if (get().isSaving) {
      return;
    }
    set({ saveQuestion: null, saveNotice: null, isSaving: true });
    const result = await pageInfoBridge.saveSite(replace);
    set({ isSaving: false });
    if (!result.ok) {
      set({ problem: result.error });
      return;
    }
    const { status, site } = result.value;
    set(
      status === 'exists'
        ? { saveQuestion: site }
        : {
            problem: null,
            saveNotice:
              status === 'saved'
                ? 'Saved. Find it under Saved sites.'
                : 'Replaced the saved results. Your note was kept.',
          },
    );
  },

  cancelSave: () => set({ saveQuestion: null }),

  openSavedSitesWindow: async () => {
    await pageInfoBridge.openSavedSitesWindow();
  },
  settings: DEFAULT_SETTINGS,
  screenshot: NO_SCREENSHOT,
  otherScreenshots: {},
  captureSize: { device: DESKTOP, reload: false, section: '' },

  setCaptureSize: (changes) =>
    set({ captureSize: { ...get().captureSize, ...changes } }),

  sectionKind: 'class',
  setSectionKind: (kind) => set({ sectionKind: kind }),

  start: async () => {
    stopListening?.();
    stopListeningToTabs?.();
    const receive = (update: PageInfoUpdate) =>
      set((state) => {
        if (update.tabId === state.update.tabId) {
          // A new page: the picture, and a Save question about the old
          // page, no longer apply.
          const changed = pageChanged(state.update, update);
          return {
            update,
            screenshot: changed ? NO_SCREENSHOT : state.screenshot,
            saveQuestion: changed ? null : state.saveQuestion,
            saveNotice: changed ? null : state.saveNotice,
          };
        }
        // Another tab: its own screenshot comes back, this one's is kept.
        const { [update.tabId]: shown, ...others } = state.otherScreenshots;
        return {
          update,
          problem: null,
          saveQuestion: null,
          saveNotice: null,
          screenshot: shown ?? NO_SCREENSHOT,
          otherScreenshots: state.update.tabId
            ? { ...others, [state.update.tabId]: state.screenshot }
            : others,
        };
      });
    const receiveTabs = (tabs: SiteTabList) =>
      set((state) => {
        // A closed tab's screenshot goes with it.
        const open = new Set(tabs.tabs.map(({ id }) => id));
        const otherScreenshots = Object.fromEntries(
          Object.entries(state.otherScreenshots).filter(([id]) => open.has(id)),
        );
        return { tabs, otherScreenshots };
      });
    stopListening = pageInfoBridge.onUpdate(receive);
    stopListeningToTabs = pageInfoBridge.onTabs(receiveTabs);
    const [result, tabs] = await Promise.all([
      pageInfoBridge.getState(),
      pageInfoBridge.getTabs(),
    ]);
    if (result.ok) {
      receive(result.value);
    }
    if (tabs.ok) {
      receiveTabs(tabs.value);
    }
  },

  newTab: async (address, ticked = false) => {
    const result = await pageInfoBridge.newTab(address, ticked);
    set({ problem: result.ok ? null : result.error });
  },

  closeTab: async (id) => {
    await pageInfoBridge.closeTab(id);
  },

  switchTab: async (id) => {
    await pageInfoBridge.switchTab(id);
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
    const { captureSize, sectionKind } = get();
    const section = sectionSelector(sectionKind, captureSize.section);
    if ('error' in section) {
      set({
        screenshot: {
          ...get().screenshot,
          problem: section.error,
          notice: null,
        },
      });
      return;
    }
    set({
      screenshot: {
        ...get().screenshot,
        status: 'taking',
        problem: null,
        notice: null,
      },
    });
    const tabId = get().update.tabId;
    const result = await pageInfoBridge.capture({
      ...captureSize,
      section: section.selector,
    });
    // Read again: the page may have changed during the capture, and its old
    // picture must not come back. You may also have moved to another tab.
    const isShown = get().update.tabId === tabId;
    const now = isShown ? get().screenshot : get().otherScreenshots[tabId];
    if (!now) {
      return; // The tab was closed.
    }
    const done: ScreenshotState = result.ok
      ? {
          status: 'done',
          shot: shownScreenshot(result.value),
          problem: null,
          notice: null,
        }
      : {
          ...now,
          status: now.shot ? 'done' : 'none',
          problem: result.error,
          notice: null,
        };
    set(
      isShown
        ? { screenshot: done }
        : { otherScreenshots: { ...get().otherScreenshots, [tabId]: done } },
    );
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

// A picture the window no longer holds gives its memory back.
usePageInfoStore.subscribe((state, previous) => {
  if (
    state.screenshot === previous.screenshot &&
    state.otherScreenshots === previous.otherScreenshots
  ) {
    return;
  }
  const kept = imageUrls(state);
  for (const url of imageUrls(previous)) {
    if (!kept.has(url)) {
      URL.revokeObjectURL(url);
    }
  }
});
