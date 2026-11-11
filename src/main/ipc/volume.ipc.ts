import { ipcMain } from 'electron';
import { uIOhook } from 'uiohook-napi';
import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import { assertSender } from './ipc-access';

const VolumeInput = z.tuple([z.enum(['up', 'down', 'mute'])]);

// Windows' own volume keys, so its normal volume display appears too.
const VOLUME_KEYS = { up: 0xe030, down: 0xe02e, mute: 0xe020 };

export function registerVolumeIpc(): void {
  ipcMain.handle(
    IpcChannels.windowVolume,
    async (event, ...input: unknown[]) => {
      assertSender(IpcChannels.windowVolume, event);
      const [change] = VolumeInput.parse(input);
      uIOhook.keyTap(VOLUME_KEYS[change]);
    },
  );
}
