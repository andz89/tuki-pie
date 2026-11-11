import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import type { ZipSelection } from '../zip/zip-selection';
import { handle } from './handle';

const NoInput = z.tuple([]);

export function registerZipIpc(selection: ZipSelection): void {
  handle(IpcChannels.zipCount, NoInput, () => selection.count());
  // The zip's own path stays in the main process.
  handle(
    IpcChannels.zipCreate,
    z.tuple([z.string().max(500)]),
    async (name) => {
      await selection.zip(name);
    },
  );
}
