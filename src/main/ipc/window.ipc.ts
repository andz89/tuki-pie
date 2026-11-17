import { ipcMain } from 'electron';
import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import { PanelFormRequest } from '../../shared/schemas/shortcut.schema';
import { assertSender } from './ipc-access';
import { openInfoCard } from '../windows/info-card-window';
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
  ipcMain.handle(IpcChannels.windowHide, (event, ...input: unknown[]) => {
    assertSender(IpcChannels.windowHide, event);
    NoInput.parse(input);
    hidePieWindow();
  });

  ipcMain.handle(IpcChannels.windowDismiss, (event, ...input: unknown[]) => {
    assertSender(IpcChannels.windowDismiss, event);
    NoInput.parse(input);
    dismissPieWindow();
  });

  ipcMain.handle(IpcChannels.windowMoveBy, (event, ...input: unknown[]) => {
    assertSender(IpcChannels.windowMoveBy, event);
    const [deltaX, deltaY] = MoveByInput.parse(input);
    movePieWindowBy(deltaX, deltaY);
  });

  ipcMain.handle(
    IpcChannels.windowSetListSide,
    (event, ...input: unknown[]) => {
      assertSender(IpcChannels.windowSetListSide, event);
      const [side] = ListSideInput.parse(input);
      setPieListSide(side);
    },
  );

  ipcMain.handle(
    IpcChannels.windowOpenShortcutForm,
    (event, ...input: unknown[]) => {
      assertSender(IpcChannels.windowOpenShortcutForm, event);
      const [request] = z.tuple([PanelFormRequest]).parse(input);
      dismissPieWindow();
      requestPanelForm(request);
    },
  );

  ipcMain.handle(
    IpcChannels.windowOpenPageInfo,
    (event, ...input: unknown[]) => {
      assertSender(IpcChannels.windowOpenPageInfo, event);
      NoInput.parse(input);
      dismissPieWindow();
      return openPageInfo();
    },
  );

  ipcMain.handle(IpcChannels.windowOpenNotes, (event, ...input: unknown[]) => {
    assertSender(IpcChannels.windowOpenNotes, event);
    NoInput.parse(input);
    dismissPieWindow();
    openNotesWindow();
  });

  ipcMain.handle(
    IpcChannels.windowOpenInfoCard,
    (event, ...input: unknown[]) => {
      assertSender(IpcChannels.windowOpenInfoCard, event);
      NoInput.parse(input);
      dismissPieWindow();
      openInfoCard();
    },
  );

  ipcMain.handle(
    IpcChannels.windowOpenSettings,
    (event, ...input: unknown[]) => {
      assertSender(IpcChannels.windowOpenSettings, event);
      NoInput.parse(input);
      dismissPieWindow();
      openPanelWindow();
    },
  );
}
