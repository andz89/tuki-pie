import { ipcMain } from 'electron';
import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import { PanelFormRequest } from '../../shared/schemas/shortcut.schema';
import { openNotesWindow } from '../windows/notes-window';
import { openPageInfo } from '../windows/page-info-window';
import { openPanelWindow, requestPanelForm } from '../windows/panel-window';
import {
  dismissPieWindow,
  hidePieWindow,
  movePieWindowBy,
  setPieListSide,
} from '../windows/pie-window';

const NoInput = z.tuple([]);
const Distance = z.number().int().min(-20000).max(20000);
const MoveByInput = z.tuple([Distance, Distance]);
const ListSideInput = z.tuple([z.enum(['left', 'right']).nullable()]);

export function registerWindowIpc(): void {
  ipcMain.handle(IpcChannels.windowHide, (_event, ...input: unknown[]) => {
    NoInput.parse(input);
    hidePieWindow();
  });

  ipcMain.handle(IpcChannels.windowDismiss, (_event, ...input: unknown[]) => {
    NoInput.parse(input);
    dismissPieWindow();
  });

  ipcMain.handle(IpcChannels.windowMoveBy, (_event, ...input: unknown[]) => {
    const [deltaX, deltaY] = MoveByInput.parse(input);
    movePieWindowBy(deltaX, deltaY);
  });

  ipcMain.handle(
    IpcChannels.windowSetListSide,
    (_event, ...input: unknown[]) => {
      const [side] = ListSideInput.parse(input);
      setPieListSide(side);
    },
  );

  ipcMain.handle(
    IpcChannels.windowOpenShortcutForm,
    (_event, ...input: unknown[]) => {
      const [request] = z.tuple([PanelFormRequest]).parse(input);
      dismissPieWindow();
      requestPanelForm(request);
    },
  );

  ipcMain.handle(
    IpcChannels.windowOpenPageInfo,
    (_event, ...input: unknown[]) => {
      NoInput.parse(input);
      dismissPieWindow();
      return openPageInfo();
    },
  );

  ipcMain.handle(IpcChannels.windowOpenNotes, (_event, ...input: unknown[]) => {
    NoInput.parse(input);
    dismissPieWindow();
    openNotesWindow();
  });

  ipcMain.handle(
    IpcChannels.windowOpenSettings,
    (_event, ...input: unknown[]) => {
      NoInput.parse(input);
      dismissPieWindow();
      openPanelWindow();
    },
  );
}
