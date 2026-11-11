import {
  DEFAULT_SETTINGS,
  Settings,
} from '../../shared/schemas/settings.schema';
import type { SettingsUpdate } from '../../shared/types';
import type { SettingsRepository } from '../repositories/settings.repository';

export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  get(): Settings {
    return Settings.parse({ ...DEFAULT_SETTINGS, ...this.settings.getAll() });
  }

  update(changes: SettingsUpdate): Settings {
    for (const [key, value] of Object.entries(changes)) {
      this.settings.set(key, value);
    }
    return this.get();
  }
}
