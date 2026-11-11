import { dialog } from 'electron';
import type { OpenDialogOptions } from 'electron';
import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import {
  NewSlice,
  Slice,
  SliceEdit,
  SliceType,
} from '../../shared/schemas/slice.schema';
import type { SliceType as SliceTypeValue } from '../../shared/types';
import type { SliceService } from '../services/slice.service';
import { getPanelWindow } from '../windows/panel-window';
import { handle } from './handle';

const PICKER_OPTIONS: Record<SliceTypeValue, OpenDialogOptions> = {
  app: {
    title: 'Choose an app',
    properties: ['openFile'],
    filters: [{ name: 'Apps', extensions: ['exe'] }],
  },
  folder: {
    title: 'Choose a folder',
    properties: ['openDirectory'],
  },
  note: {
    title: 'Choose a note',
    properties: ['openFile'],
    filters: [
      {
        name: 'Notes and documents',
        extensions: ['txt', 'md', 'rtf', 'doc', 'docx', 'odt', 'pdf'],
      },
      { name: 'All files', extensions: ['*'] },
    ],
  },
};

async function pickPath(type: SliceTypeValue): Promise<string | null> {
  const panel = getPanelWindow();
  if (!panel) {
    return null;
  }
  const { canceled, filePaths } = await dialog.showOpenDialog(
    panel,
    PICKER_OPTIONS[type],
  );
  return canceled ? null : filePaths[0];
}

export function registerPanelIpc(slices: SliceService): void {
  // These messages can only come from the settings window, so saving an app
  // there counts as the person approving it.
  const approveApp = ({ type, path }: NewSlice) => {
    if (type === 'app') {
      slices.allowApp(path);
    }
  };

  handle(IpcChannels.panelSliceAdd, z.tuple([NewSlice]), (item) => {
    approveApp(item);
    return slices.add(item);
  });

  handle(IpcChannels.panelSliceUpdate, z.tuple([SliceEdit]), (edit) => {
    approveApp(edit);
    return slices.update(edit);
  });

  handle(IpcChannels.panelSliceRemove, z.tuple([Slice.shape.id]), (id) =>
    slices.remove(id),
  );

  handle(
    IpcChannels.panelSlicesReorder,
    z.tuple([Slice.shape.id.array().max(8)]),
    (ids) => slices.reorder(ids),
  );

  handle(IpcChannels.panelAllowedAppsList, z.tuple([]), () =>
    slices.listAllowedApps(),
  );

  handle(
    IpcChannels.panelAllowedAppRemove,
    z.tuple([Slice.shape.path]),
    (path) => slices.removeAllowedApp(path),
  );

  handle(IpcChannels.panelPickPath, z.tuple([SliceType]), pickPath);
}
