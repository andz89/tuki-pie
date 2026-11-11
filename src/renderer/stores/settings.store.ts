import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type { Settings, SettingsUpdate } from '../../shared/types';
import { bridge } from '../api/bridge';

interface SettingsState extends Settings {
  load: () => Promise<void>;
  update: (changes: SettingsUpdate) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,

  load: async () => {
    const result = await bridge.settings.get();
    if (result.ok) {
      set(result.value);
    }
  },

  update: async (changes) => {
    const result = await bridge.settings.update(changes);
    if (result.ok) {
      set(result.value);
    }
  },
}));
