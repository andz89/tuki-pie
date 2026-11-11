import { dialog } from 'electron';
import type { OpenDialogOptions } from 'electron';
import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import { Slice, SliceType } from '../../shared/schemas/slice.schema';
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
