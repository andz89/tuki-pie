import {
  DEFAULT_SETTINGS,
  Settings,
} from '../../shared/schemas/settings.schema';
import type { SettingsUpdate } from '../../shared/types';
import type { SettingsRepository } from '../repositories/settings.repository';

// What a change does outside the database, wired in main.ts.
export interface SettingsEffects {
  // Registers the keys that open the donut. Throws when they can't be
  // used, so they are never saved.
  useOpenKeys(keys: string): void;
  // After every saved change: the donut's size and pin, Chrome's switch.
  applied(saved: Settings): void;
}

const NO_EFFECTS: SettingsEffects = {
  useOpenKeys: () => undefined,
  applied: () => undefined,
};

export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly effects: SettingsEffects = NO_EFFECTS,
  ) {}

  // Each key on its own: one stored value that no longer fits (from an older
  // build, or edited by hand) falls back to its default instead of stopping
  // the app from starting.
  get(): Settings {
    const stored = this.settings.getAll();
    const loaded: Record<string, unknown> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>) {
      const result = Settings.shape[key].safeParse(stored[key]);
      loaded[key] = result.success ? result.data : DEFAULT_SETTINGS[key];
    }
    return Settings.parse(loaded);
  }

  // A change from the settings window or the donut.
  change(changes: SettingsUpdate): Settings {
    if (changes.openKeys !== undefined) {
      this.effects.useOpenKeys(changes.openKeys);
    }
    const saved = this.update(changes);
    this.effects.applied(saved);
    return saved;
  }

  // Saves only, with nothing else happening: first run and Page Info's own
  // settings use this.
  update(changes: SettingsUpdate): Settings {
    for (const [key, value] of Object.entries(changes)) {
      this.settings.set(key, value);
    }
    return this.get();
  }
}
