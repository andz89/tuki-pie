import { create } from 'zustand';
import type {
  ListSide,
  PanelFormRequest,
  ScreenshotMode,
  Shortcut,
  Snippet,
  VolumeChange,
} from '../../shared/types';
import { bridge } from '../api/bridge';
import type { Point } from './ring-press';
import { createHover } from './pie-hover';
import { createWindowActions } from './pie-window-actions';
import { useSettingsStore } from './settings.store';

const COPIED_NOTICE_MS = 1200;

// Same words the main process uses when there is nothing to zip.
const NO_IMAGES_MESSAGE =
  'Select images in File Explorer, then open the donut there.';

// One timer, so a second copy can't be cut short by the first one's.
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

export interface CircleHint {
  label: string;
  value: string;
}

export interface PieState {
  shortcuts: Shortcut[];
  // Each app shortcut's own icon, once read: an image address, or null.
  // By appIconKey. Null while the read is on its way.
  appIcons: Record<string, string | null>;
  snippets: Snippet[];
  // Images selected in Explorer when the donut opened. null: still asking.
  zipCount: number | null;
  // The name box for the zip is showing in the middle.
  zipNaming: boolean;
  hoveredIndex: number | null;
  // The slice whose circles or list are showing.
  openIndex: number | null;
  // The slice kept open by a double-click.
  lockedIndex: number | null;
  listSide: ListSide | null;
  circleHint: CircleHint | null;
  error: string | null;
  notice: string | null;
  load: () => Promise<void>;
  loadShortcuts: () => Promise<void>;
  loadAppIcon: (id: string, target: string | null) => Promise<void>;
  loadSnippets: () => Promise<void>;
  loadZipCount: () => Promise<void>;
  startZip: () => void;
  cancelZip: () => void;
  zipImages: (name: string) => Promise<void>;
  copySnippet: (id: string) => Promise<void>;
  setHovered: (index: number | null, at?: Point) => void;
  trackPointer: (at: Point) => void;
  pressSlice: (index: number, at: Point) => void;
  unlock: () => void;
  setCircleHint: (hint: CircleHint | null) => void;
  moveWindowBy: (deltaX: number, deltaY: number) => void;
  changeVolume: (change: VolumeChange) => void;
  openRingItem: (index: number) => void;
  openShortcut: (id: string) => Promise<void>;
  openSettings: () => void;
  openPageInfo: () => void;
  openNotes: () => void;
  takeScreenshot: (mode: ScreenshotMode) => Promise<void>;
  openShortcutForm: (request: PanelFormRequest) => void;
  close: () => void;
  dismiss: () => void;
  opened: () => void;
}

export function appIconKey(id: string, target: string | null): string {
  return `${id}\n${target ?? ''}`;
}

export const usePieStore = create<PieState>()((set, get, store) => {
  const { reset, actions: hover } = createHover(store);
  return {
    ...hover,
    ...createWindowActions(store, reset),

    shortcuts: [],
    appIcons: {},
    snippets: [],
    zipCount: null,
    zipNaming: false,
    hoveredIndex: null,
    openIndex: null,
    lockedIndex: null,
    listSide: null,
    circleHint: null,
    error: null,
    notice: null,

    // Runs on every focus. Clicking a pinned donut gives it focus, so this
    // leaves the highlight alone: clearing it would close the Settings circles
    // under that same click. Resetting is opened()'s job.
    load: async () => {
      set({ error: null });
      void get().loadZipCount();
      await get().loadShortcuts();
      await get().loadSnippets();
    },

    loadShortcuts: async () => {
      const result = await bridge.shortcuts.list();
      if (result.ok) {
        set({ shortcuts: result.value });
      } else {
        set({ error: result.error });
      }
    },

    // Read once per app and file, so an edited app gets its new icon. A failed
    // read shows the app's first letter, and is tried again next time.
    loadAppIcon: async (id, target) => {
      const key = appIconKey(id, target);
      if (key in get().appIcons) {
        return;
      }
      set((state) => ({ appIcons: { ...state.appIcons, [key]: null } }));
      const result = await bridge.shortcuts.icon(id);
      set((state) => {
        const appIcons = { ...state.appIcons };
        if (result.ok && result.value) {
          appIcons[key] = result.value;
        } else {
          delete appIcons[key];
        }
        return { appIcons };
      });
    },

    loadSnippets: async () => {
      const result = await bridge.snippets.list();
      if (result.ok) {
        set({ snippets: result.value });
      } else {
        set({ error: result.error });
      }
    },

    // Explorer can take a second to answer, so the slice says it is looking.
    loadZipCount: async () => {
      set({ zipCount: null });
      const result = await bridge.zip.count();
      set({ zipCount: result.ok ? result.value : 0 });
    },

    // Asks for a name in the middle of the donut first.
    startZip: () => {
      reset();
      if (get().zipCount === 0) {
        set({ error: NO_IMAGES_MESSAGE, circleHint: null });
        return;
      }
      set({ error: null, circleHint: null, zipNaming: true });
    },

    cancelZip: () => set({ zipNaming: false }),

    zipImages: async (name) => {
      reset();
      set({ error: null, circleHint: null, zipNaming: false });
      const result = await bridge.zip.create(name);
      if (!result.ok) {
        set({ error: result.error });
        return;
      }
      get().dismiss();
    },

    copySnippet: async (id) => {
      const result = await bridge.snippets.copy(id);
      if (!result.ok) {
        reset();
        set({ error: result.error });
        return;
      }
      // Only a pinned donut is still on screen to show this.
      if (useSettingsStore.getState().pin === 'pinned') {
        clearTimeout(noticeTimer);
        set({ notice: 'Copied' });
        noticeTimer = setTimeout(() => set({ notice: null }), COPIED_NOTICE_MS);
      }
      get().dismiss();
    },

    setCircleHint: (hint) => set({ circleHint: hint }),
  };
});
