import { create } from 'zustand';
import { PIE_SCALES } from '../../shared/schemas/settings.schema';
import { LIST_EXTRA_WIDTH } from '../../shared/types';
import type {
  ListSide,
  PanelFormRequest,
  ScreenshotMode,
  Shortcut,
  Snippet,
  VolumeChange,
} from '../../shared/types';
import { bridge } from '../api/bridge';
import {
  APPS_INDEX,
  NOTES_INDEX,
  PAGE_INFO_INDEX,
  SCREENSHOT_INDEX,
  SETTINGS_INDEX,
  SHORTCUTS_INDEX,
  SNIPPETS_INDEX,
  ZIP_INDEX,
} from '../components/slice-display';
import { aimBox, donutHole } from './pie-pointer';
import {
  AIM_HOLD_MS,
  AIM_MIN_MOVE,
  DOUBLE_MS,
  aimsAt,
  inHole,
  isDoublePress,
  pressOutcome,
} from './ring-press';
import type { Point, Press } from './ring-press';
import { useSettingsStore } from './settings.store';

const COPIED_NOTICE_MS = 1200;

// Same words the main process uses when there is nothing to zip.
const NO_IMAGES_MESSAGE =
  'Select images in File Explorer, then open the donut there.';

// One timer, so a second copy can't be cut short by the first one's.
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

// Where the mouse was a few pixels ago, to tell which way it is heading.
let aimFrom: Point | null = null;
// While the mouse heads for what is open across another slice: the slice
// that takes over once the hold ends, and the hold's timer.
let aimTimer: ReturnType<typeof setTimeout> | undefined;
let aimPending: { index: number | null; at?: Point } | null = null;
// A lockable slice's click, waiting to see if a second one makes it a
// double-click.
let lastPress: Press | null = null;
let clickTimer: ReturnType<typeof setTimeout> | undefined;

function endAim() {
  clearTimeout(aimTimer);
  aimTimer = undefined;
  aimPending = null;
}

// The list goes on the right, unless the screen ends too soon there.
function pickListSide(): ListSide {
  if (typeof window === 'undefined') {
    return 'right';
  }
  const scale = PIE_SCALES[useSettingsStore.getState().size];
  const { availWidth } = window.screen;
  const availLeft =
    (window.screen as Screen & { availLeft?: number }).availLeft ?? 0;
  const roomRight =
    availLeft + availWidth - (window.screenX + window.outerWidth);
  return roomRight >= LIST_EXTRA_WIDTH * scale ? 'right' : 'left';
}

function setListSide(side: ListSide | null) {
  if (usePieStore.getState().listSide === side) {
    return;
  }
  usePieStore.setState({ listSide: side });
  void bridge.window.setListSide(side);
}

const closeList = () => setListSide(null);

// Slices that show a list card beside the donut, instead of circles.
const LIST_SLICES = new Set([SHORTCUTS_INDEX, SNIPPETS_INDEX]);

// The window is wide while one of them is the open slice.
function syncList() {
  const { openIndex, listSide } = usePieStore.getState();
  setListSide(
    openIndex !== null && LIST_SLICES.has(openIndex)
      ? (listSide ?? pickListSide())
      : null,
  );
}

// Nothing marked, open or locked: after an action, or a fresh opening.
const RESET = {
  hoveredIndex: null,
  openIndex: null,
  lockedIndex: null,
  zipNaming: false,
};
function reset() {
  endAim();
  clearTimeout(clickTimer);
  lastPress = null;
  usePieStore.setState(RESET);
  closeList();
}

// Moving onto a slice (index), or off them all (null) at the point `at`.
// Off the slices, what is open stays, to come back to, except in the hole in
// the middle.
function applyHover(index: number | null, at?: Point) {
  endAim();
  if (index === null) {
    const hole = at ? donutHole() : null;
    usePieStore.setState(
      hole && at && inHole(at, hole)
        ? { hoveredIndex: null, openIndex: null }
        : { hoveredIndex: null },
    );
  } else {
    usePieStore.setState({
      hoveredIndex: index,
      openIndex: index,
      error: null,
    });
  }
  syncList();
}

export interface CircleHint {
  label: string;
  value: string;
}

interface PieState {
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

export const usePieStore = create<PieState>()((set, get) => ({
  // Main says the window is opening. An unpinned donut starts fresh. A pinned
  // one keeps what it shows, but main made its window a square again (at the
  // cursor), so a list still open asks for its room again.
  opened: () => {
    if (useSettingsStore.getState().pin !== 'pinned') {
      reset();
      return;
    }
    usePieStore.setState({ listSide: null });
    syncList();
  },

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

  // A message stays up when the mouse leaves, and goes when it points elsewhere.
  // While a slice is locked, nothing else answers the mouse. Heading for what
  // is open across another slice, that slice takes over only after a moment.
  setHovered: (index, at) => {
    const { lockedIndex, openIndex } = get();
    if (lockedIndex !== null) {
      return;
    }
    if (index === openIndex || index === null || openIndex === null || !at) {
      if (aimTimer !== undefined && index !== openIndex) {
        aimPending = { index, at };
        return;
      }
      applyHover(index, at);
      return;
    }
    const box = aimBox();
    const hole = donutHole();
    const heading =
      box &&
      hole &&
      aimFrom &&
      (Math.hypot(at.x - aimFrom.x, at.y - aimFrom.y) < AIM_MIN_MOVE ||
        aimsAt(aimFrom, at, box, hole));
    if (!heading) {
      applyHover(index, at);
      return;
    }
    aimPending = { index, at };
    // Once, when the hold starts: then what is under the mouse takes over.
    aimTimer ??= setTimeout(() => {
      const pending = aimPending;
      aimTimer = undefined;
      if (pending && get().lockedIndex === null) {
        applyHover(pending.index, pending.at);
      }
    }, AIM_HOLD_MS);
  },

  trackPointer: (at) => {
    if (
      !aimFrom ||
      Math.hypot(at.x - aimFrom.x, at.y - aimFrom.y) >= AIM_MIN_MOVE
    ) {
      aimFrom = at;
    }
  },

  // A click on a slice. A double-click on one with circles or a list locks
  // it, so its single click waits a moment first.
  pressSlice: (index, at) => {
    const press = { index, ...at, at: Date.now() };
    const isDouble = isDoublePress(lastPress, press);
    lastPress = isDouble ? null : press;
    const outcome = pressOutcome(get().lockedIndex, index, isDouble);
    if (outcome !== 'wait') {
      clearTimeout(clickTimer);
    }
    if (outcome === 'lock') {
      endAim();
      set({ lockedIndex: index, hoveredIndex: index, openIndex: index });
      syncList();
    } else if (outcome === 'unlock') {
      get().unlock();
      applyHover(index, at);
    } else if (outcome === 'wait') {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => get().openRingItem(index), DOUBLE_MS);
    } else if (outcome === 'run') {
      get().openRingItem(index);
    }
  },

  unlock: () => set({ lockedIndex: null }),

  setCircleHint: (hint) => set({ circleHint: hint }),

  moveWindowBy: (deltaX, deltaY) => {
    void bridge.window.moveBy(deltaX, deltaY);
  },

  changeVolume: (change) => {
    void bridge.window.volume(change);
  },

  openRingItem: (index) => {
    // Picking a part is what people want most, so the slice itself does that.
    if (index === SCREENSHOT_INDEX) {
      void get().takeScreenshot('section');
    } else if (index === SNIPPETS_INDEX) {
      get().openShortcutForm({ kind: 'snippets-section' });
    } else if (index === SHORTCUTS_INDEX) {
      get().openShortcutForm({ kind: 'section' });
    } else if (index === APPS_INDEX) {
      get().openShortcutForm({ kind: 'apps-section' });
    } else if (index === PAGE_INFO_INDEX) {
      get().openPageInfo();
    } else if (index === NOTES_INDEX) {
      get().openNotes();
    } else if (index === ZIP_INDEX) {
      get().startZip();
    } else if (index === SETTINGS_INDEX) {
      get().openSettings();
    }
  },

  openShortcut: async (id) => {
    const result = await bridge.shortcuts.open(id);
    reset();
    if (result.ok) {
      get().dismiss();
    } else {
      set({ error: result.error });
    }
  },

  openSettings: () => {
    reset();
    set({ error: null, circleHint: null });
    void bridge.window.openSettings();
  },

  openPageInfo: () => {
    reset();
    set({ error: null, circleHint: null });
    void bridge.window.openPageInfo();
  },

  openNotes: () => {
    reset();
    set({ error: null, circleHint: null });
    void bridge.window.openNotes();
  },

  // The donut steps aside on its own, so it isn't in the picture.
  takeScreenshot: async (mode) => {
    reset();
    set({ error: null, circleHint: null });
    const result = await bridge.screenshot.take(mode);
    if (!result.ok) {
      set({ error: result.error });
    }
  },

  openShortcutForm: (request) => {
    reset();
    set({ error: null, circleHint: null });
    void bridge.window.openShortcutForm(request);
  },

  close: () => {
    reset();
    set({ error: null, circleHint: null });
    void bridge.window.hide();
  },

  // The main process knows whether the donut is pinned, even if that changed
  // in the settings window a moment ago.
  dismiss: () => {
    set({ error: null });
    void bridge.window.dismiss();
  },
}));
