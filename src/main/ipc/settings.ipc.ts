import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import { SettingsUpdate } from '../../shared/schemas/settings.schema';
import type { SettingsService } from '../services/settings.service';
import { setOpenKeys } from '../shortcuts/open-keys';
import { setPiePin, setPieSize } from '../windows/pie-window';
import { handle } from './handle';

// `onChanged` runs after every saved change.
export function registerSettingsIpc(
  settings: SettingsService,
  onChanged: () => void = () => undefined,
): void {
  handle(IpcChannels.settingsGet, z.tuple([]), () => settings.get());

  handle(IpcChannels.settingsUpdate, z.tuple([SettingsUpdate]), (changes) => {
    // Throws for keys that can't be used, so they are never saved.
    if (changes.openKeys !== undefined) {
      setOpenKeys(changes.openKeys);
    }
    const saved = settings.update(changes);
    setPieSize(saved.size);
    setPiePin(saved.pin);
    onChanged();
    return saved;
  });
}
