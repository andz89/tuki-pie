import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import {
  PieLookUpdate,
  SettingsUpdate,
} from '../../shared/schemas/settings.schema';
import type { SettingsUpdate as SettingsChanges } from '../../shared/types';
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

  const save = (changes: SettingsChanges) => {
    // Throws for keys that can't be used, so they are never saved.
    if (changes.openKeys !== undefined) {
      setOpenKeys(changes.openKeys);
    }
    const saved = settings.update(changes);
    setPieSize(saved.size);
    setPiePin(saved.pin);
    onChanged();
    return saved;
  };

  // The settings window, which can change anything.
  handle(IpcChannels.settingsUpdate, z.tuple([SettingsUpdate]), save);

  // The donut, which only changes its look.
  handle(IpcChannels.pieSettingsUpdate, z.tuple([PieLookUpdate]), save);
}
