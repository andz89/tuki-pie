import { app, powerMonitor } from 'electron';
import { OPEN_PIE_FLAG, installShellMenu } from '../shell-menu/shell-menu';
import { setOpenKeys } from '../shortcuts/open-keys';
import {
  openPieAtCursor,
  startShortcuts,
  stopShortcuts,
} from '../shortcuts/shortcuts';
import type { Startup } from '../startup';
import { createTray } from '../tray/tray';
import { openPanelWindow } from '../windows/panel-window';
import { createPieWindow, setPiePin, setPieSize } from '../windows/pie-window';
import { setPageInfoOnTop } from '../windows/page-info-window';
import type { Services } from './build-services';

// Shows what the app shows and starts what runs in the background.
export function startRuntime(
  startup: Startup,
  { isNew, settings, reminders }: Services,
): void {
  createPieWindow();
  setPieSize(settings.get().size);
  setPiePin(settings.get().pin);
  setPageInfoOnTop(settings.get().pageInfoOnTop);
  createTray({ openSettings: openPanelWindow, quit: () => app.quit() });
  startShortcuts();
  startup.onQuit(stopShortcuts);
  try {
    setOpenKeys(settings.get().openKeys);
  } catch (error) {
    // Another app took the keys since. The other ways to open still work.
    console.warn('Could not register the open keys:', error);
  }
  // Written on every start, so the entry follows the app when it updates.
  if (app.isPackaged && process.platform === 'win32') {
    installShellMenu(process.execPath);
  }
  // Reminders missed while the app was closed show now.
  reminders.refresh();
  // A computer waking from sleep catches up on reminders right away.
  powerMonitor.on('resume', () => reminders.refresh());

  if (isNew) {
    openPanelWindow();
  }
  // Started from the right-click menu while not running.
  if (process.argv.includes(OPEN_PIE_FLAG)) {
    openPieAtCursor();
  }
}
