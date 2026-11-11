import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import {
  PieLookUpdate,
  SettingsUpdate,
} from '../../shared/schemas/settings.schema';
import type { SettingsService } from '../services/settings.service';
import { handle } from './handle';

export function registerSettingsIpc(settings: SettingsService): void {
  handle(IpcChannels.settingsGet, z.tuple([]), () => settings.get());

  // The settings window, which can change anything.
  handle(IpcChannels.settingsUpdate, z.tuple([SettingsUpdate]), (changes) =>
    settings.change(changes),
  );

  // The donut, which only changes its look.
  handle(IpcChannels.pieSettingsUpdate, z.tuple([PieLookUpdate]), (changes) =>
    settings.change(changes),
  );
}
