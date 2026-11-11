import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type {
  NewShortcut,
  NewSnippet,
  PanelFormRequest,
  Result,
  Settings,
  SettingsUpdate,
  Shortcut,
  ShortcutEdit,
  SliceType,
  Snippet,
  SnippetEdit,
  SuggestionChange,
  SuggestionGroup,
} from '../../shared/types';
import { moveItem } from '../../shared/suggestions';
import { panelBridge } from './panel-bridge';
import { tabForRequest } from './settings-tabs';
import type { SettingsTab } from './settings-tabs';

interface PanelState {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  shortcuts: Shortcut[];
  snippets: Snippet[];
  suggestions: SuggestionGroup[];
  formRequest: PanelFormRequest | null;
  allowedApps: string[];
  settings: Settings;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  addSnippet: (item: NewSnippet) => Promise<boolean>;
  updateSnippet: (edit: SnippetEdit) => Promise<boolean>;
  removeSnippet: (id: string) => Promise<void>;
  moveSnippet: (id: string, step: 1 | -1) => Promise<void>;
  changeSuggestions: (change: SuggestionChange) => Promise<boolean>;
  // Dragging: lands before the group now at `to`.
  moveSuggestionGroup: (from: number, to: number) => Promise<void>;
  showError: (message: string) => void;
  addShortcut: (item: NewShortcut) => Promise<boolean>;
  updateShortcut: (edit: ShortcutEdit) => Promise<boolean>;
  removeShortcut: (id: string) => Promise<void>;
  moveShortcut: (id: string, step: 1 | -1) => Promise<void>;
  placeShortcut: (
    id: string,
    parentId: string | null,
    index: number,
  ) => Promise<void>;
  pickUpFormRequest: () => Promise<void>;
  clearFormRequest: () => void;
  updateSettings: (changes: SettingsUpdate) => Promise<void>;
  // The colour picker sends a value on every step of a drag.
  dragAccent: (accent: string) => void;
  removeAllowedApp: (path: string) => Promise<void>;
  pickPath: (type: SliceType) => Promise<string | null>;
  clearError: () => void;
}

const ACCENT_SAVE_MS = 250;
let accentTimer: ReturnType<typeof setTimeout> | undefined;

export const usePanelStore = create<PanelState>()((set, get) => {
  // Applies a successful answer, or shows the reason it failed.
  const accept = <Value>(
    result: Result<Value>,
    apply: (value: Value) => void,
  ): boolean => {
    if (!result.ok) {
      set({ error: result.error });
      return false;
    }
    set({ error: null });
    apply(result.value);
    return true;
  };

  const setShortcuts = (shortcuts: Shortcut[]) => set({ shortcuts });
  const setSnippets = (snippets: Snippet[]) => set({ snippets });
  const setSuggestions = (suggestions: SuggestionGroup[]) =>
    set({ suggestions });
  const setAllowedApps = (allowedApps: string[]) => set({ allowedApps });

  // Saving an app also adds it to the allowed list.
  const saveShortcut = async (result: Result<Shortcut[]>): Promise<boolean> => {
    const saved = accept(result, setShortcuts);
    if (saved) {
      accept(await panelBridge.allowedApps.list(), setAllowedApps);
    }
    return saved;
  };

  return {
    activeTab: 'shortcuts',
    setActiveTab: (tab) => set({ activeTab: tab }),
    shortcuts: [],
    snippets: [],
    suggestions: [],
    formRequest: null,
    allowedApps: [],
    settings: DEFAULT_SETTINGS,
    error: null,

    // Runs on every focus, so a working read leaves the message on screen:
    // clicking back into the window must not wipe why a save failed.
    load: async () => {
      const show = <Value>(
        result: Result<Value>,
        apply: (value: Value) => void,
      ) => {
        if (result.ok) {
          apply(result.value);
        } else {
          set({ error: result.error });
        }
      };
      show(await panelBridge.shortcuts.list(), setShortcuts);
      show(await panelBridge.snippets.list(), setSnippets);
      show(await panelBridge.suggestions.list(), setSuggestions);
      show(await panelBridge.settings.get(), (settings) => set({ settings }));
      show(await panelBridge.allowedApps.list(), setAllowedApps);
    },

    // In this order, so a request to edit a snippet can find that snippet.
    refresh: async () => {
      await get().load();
      await get().pickUpFormRequest();
    },

    addSnippet: async (item) =>
      accept(await panelBridge.snippets.add(item), setSnippets),

    updateSnippet: async (edit) =>
      accept(await panelBridge.snippets.update(edit), setSnippets),

    removeSnippet: async (id) => {
      accept(await panelBridge.snippets.remove(id), setSnippets);
    },

    moveSnippet: async (id, step) => {
      const ids = get().snippets.map((snippet) => snippet.id);
      const from = ids.indexOf(id);
      const to = from + step;
      if (from === -1 || to < 0 || to >= ids.length) {
        return;
      }
      [ids[from], ids[to]] = [ids[to], ids[from]];
      accept(await panelBridge.snippets.reorder(ids), setSnippets);
    },

    changeSuggestions: async (change) =>
      accept(await panelBridge.suggestions.change(change), setSuggestions),

    moveSuggestionGroup: async (from, to) => {
      const ids = get().suggestions.map((group) => group.id);
      const moved = moveItem(ids, from, to);
      if (moved.every((id, index) => id === ids[index])) {
        return;
      }
      await get().changeSuggestions({ kind: 'reorder-groups', ids: moved });
    },

    showError: (message) => set({ error: message }),

    addShortcut: async (item) =>
      saveShortcut(await panelBridge.shortcuts.add(item)),

    updateShortcut: async (edit) =>
      saveShortcut(await panelBridge.shortcuts.update(edit)),

    removeShortcut: async (id) => {
      accept(await panelBridge.shortcuts.remove(id), setShortcuts);
    },

    moveShortcut: async (id, step) => {
      const { shortcuts } = get();
      const moved = shortcuts.find((item) => item.id === id);
      const parentId = moved?.parentId;
      const isApp = moved?.type === 'app';
      // Apps are ordered among themselves, links and groups among theirs.
      const ids = shortcuts
        .filter(
          (item) =>
            item.parentId === parentId && (item.type === 'app') === isApp,
        )
        .map((item) => item.id);
      const from = ids.indexOf(id);
      const to = from + step;
      if (parentId === undefined || to < 0 || to >= ids.length) {
        return;
      }
      [ids[from], ids[to]] = [ids[to], ids[from]];
      accept(await panelBridge.shortcuts.reorder(parentId, ids), setShortcuts);
    },

    placeShortcut: async (id, parentId, index) => {
      accept(
        await panelBridge.shortcuts.move(id, parentId, index),
        setShortcuts,
      );
    },

    // Runs on every focus, so it must leave any message on screen alone.
    pickUpFormRequest: async () => {
      const result = await panelBridge.takeFormRequest();
      if (result.ok && result.value) {
        set({
          formRequest: result.value,
          activeTab: tabForRequest(result.value),
        });
      }
    },

    clearFormRequest: () => set({ formRequest: null }),

    updateSettings: async (changes) => {
      accept(await panelBridge.settings.update(changes), (settings) =>
        set({ settings }),
      );
    },

    // Shown in this window at once; saved (a message, a database write and
    // every window restyling) only once the drag pauses.
    dragAccent: (accent) => {
      set({ settings: { ...get().settings, accent } });
      clearTimeout(accentTimer);
      accentTimer = setTimeout(
        () => void get().updateSettings({ accent }),
        ACCENT_SAVE_MS,
      );
    },

    removeAllowedApp: async (path) => {
      accept(await panelBridge.allowedApps.remove(path), setAllowedApps);
    },

    pickPath: async (type) => {
      let picked: string | null = null;
      accept(await panelBridge.pickPath(type), (value) => {
        picked = value;
      });
      return picked;
    },

    clearError: () => set({ error: null }),
  };
});
