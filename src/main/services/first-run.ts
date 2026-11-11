import { DEFAULT_SETTINGS } from '../../shared/schemas/settings.schema';
import type { SettingsService } from './settings.service';

export function seedFirstRun(settings: SettingsService): void {
  settings.update(DEFAULT_SETTINGS);
}
