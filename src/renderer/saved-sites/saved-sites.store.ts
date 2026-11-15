import { create } from 'zustand';
import type { SavedSite, SavedSiteSummary } from '../../shared/types';
import { blobUrlFromDataUrl } from '../page-info/blob-url';
import { savedSitesBridge } from './saved-sites-bridge';

// The selected site's picture: not asked for yet, on its way, shown as a
// blob address, or saved as having one that can't be read any more.
export interface SavedScreenshot {
  status: 'idle' | 'loading' | 'ready' | 'missing';
  url: string | null;
}

const NO_SAVED_SCREENSHOT: SavedScreenshot = { status: 'idle', url: null };

interface SavedSitesState {
  sites: SavedSiteSummary[];
  selected: SavedSite | null;
  screenshot: SavedScreenshot;
  problem: string | null;
  // What Save or Copy just did.
  notice: string | null;
  start: () => Promise<void>;
  refresh: () => Promise<void>;
  select: (id: string | null) => Promise<void>;
  setNote: (id: string, note: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  // Whether the site is being checked in Page Info now.
  openLive: (id: string) => Promise<boolean>;
  loadScreenshot: () => Promise<void>;
  saveScreenshot: () => Promise<void>;
  copyScreenshot: () => Promise<void>;
}

// Title, address and note, so a search finds a site by any of them.
export function matchesSearch(site: SavedSiteSummary, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${site.title} ${site.address} ${site.note}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

// One listener at a time, even when React runs the start-up effect twice.
let stopListening: (() => void) | undefined;

export const useSavedSitesStore = create<SavedSitesState>()((set, get) => ({
  sites: [],
  selected: null,
  screenshot: NO_SAVED_SCREENSHOT,
  problem: null,
  notice: null,

  start: async () => {
    stopListening?.();
    stopListening = savedSitesBridge.onChanged(() => void get().refresh());
    await get().refresh();
  },

  // Keeps the open site, unless it was deleted, or saved again with new
  // results somewhere else.
  refresh: async () => {
    const result = await savedSitesBridge.list();
    if (!result.ok) {
      return;
    }
    set({ sites: result.value });
    const { selected } = get();
    if (!selected) {
      return;
    }
    const now = result.value.find(({ id }) => id === selected.id);
    if (!now) {
      set({ selected: null, screenshot: NO_SAVED_SCREENSHOT });
    } else if (now.savedAt !== selected.savedAt) {
      await get().select(selected.id);
    }
  },

  select: async (id) => {
    set({ problem: null, notice: null, screenshot: NO_SAVED_SCREENSHOT });
    if (id === null) {
      set({ selected: null });
      return;
    }
    const result = await savedSitesBridge.get(id);
    set(
      result.ok
        ? { selected: result.value }
        : { selected: null, problem: result.error },
    );
  },

  // Only the list's copy changes here, so the text box you type in keeps
  // its own value. A site deleted in the meantime has nothing to keep.
  setNote: async (id, note) => {
    if (!get().sites.some((site) => site.id === id)) {
      return;
    }
    const result = await savedSitesBridge.setNote(id, note);
    if (!result.ok) {
      set({ problem: result.error });
    }
  },

  remove: async (id) => {
    const result = await savedSitesBridge.remove(id);
    if (!result.ok) {
      set({ problem: result.error });
      return;
    }
    // Gone from the list at once, before the change notice arrives.
    set((state) => ({
      sites: state.sites.filter((site) => site.id !== id),
      ...(state.selected?.id === id
        ? { selected: null, screenshot: NO_SAVED_SCREENSHOT }
        : {}),
    }));
  },

  openLive: async (id) => {
    const result = await savedSitesBridge.openLive(id);
    set({ problem: result.ok ? null : result.error });
    return result.ok;
  },

  loadScreenshot: async () => {
    const id = get().selected?.id;
    if (!id || get().screenshot.status !== 'idle') {
      return;
    }
    set({ screenshot: { status: 'loading', url: null } });
    const result = await savedSitesBridge.screenshot(id);
    // Another site may have been picked in the meantime.
    if (get().selected?.id !== id) {
      return;
    }
    if (result.ok && result.value !== null) {
      set({
        screenshot: { status: 'ready', url: blobUrlFromDataUrl(result.value) },
      });
    } else {
      set({
        screenshot: { status: 'missing', url: null },
        problem: result.ok ? null : result.error,
      });
    }
  },

  saveScreenshot: async () => {
    const id = get().selected?.id;
    if (!id) {
      return;
    }
    const result = await savedSitesBridge.saveScreenshot(id);
    set(
      result.ok
        ? { notice: 'Saved to Pictures\\Pie Launcher.', problem: null }
        : { problem: result.error, notice: null },
    );
  },

  copyScreenshot: async () => {
    const id = get().selected?.id;
    if (!id) {
      return;
    }
    const result = await savedSitesBridge.copyScreenshot(id);
    set(
      result.ok
        ? { notice: 'Copied.', problem: null }
        : { problem: result.error, notice: null },
    );
  },
}));

// A picture no longer shown gives its memory back.
useSavedSitesStore.subscribe((state, previous) => {
  const old = previous.screenshot.url;
  if (old && old !== state.screenshot.url) {
    URL.revokeObjectURL(old);
  }
});
