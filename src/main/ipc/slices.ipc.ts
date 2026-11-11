import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import { Slice } from '../../shared/schemas/slice.schema';
import type { SliceService } from '../services/slice.service';
import { handle } from './handle';

export function registerSliceIpc(slices: SliceService): void {
  handle(IpcChannels.slicesList, z.tuple([]), () => slices.list());

  // Takes an id, never a path: the path comes from the database.
  handle(IpcChannels.slicesOpen, z.tuple([Slice.shape.id]), (id) =>
    slices.openSlice(id),
  );
}
