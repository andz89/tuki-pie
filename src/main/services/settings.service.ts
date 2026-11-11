import {
  DEFAULT_SETTINGS,
  Settings,
} from '../../shared/schemas/settings.schema';
import type { SettingsUpdate } from '../../shared/types';
import type { SettingsRepository } from '../repositories/settings.repository';

export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

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

  update(changes: SettingsUpdate): Settings {
    for (const [key, value] of Object.entries(changes)) {
      this.settings.set(key, value);
    }
    return this.get();
  }
}
