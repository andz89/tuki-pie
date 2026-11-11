import {
  Notification,
  app,
  clipboard,
  dialog,
  powerMonitor,
  session,
  shell,
} from 'electron';
import started from 'electron-squirrel-startup';
import path from 'node:path';
import { startChromeBridge } from './chrome-bridge/chrome-connection';
import { PairingCode } from './chrome-bridge/pairing-code';
import { SuggestionSync } from './chrome-bridge/suggestion-sync';
import { canOpen, readLinkFilter } from '../shared/link-rules';
import { openDatabase } from './db/db';
import { registerChromeIpc } from './ipc/chrome.ipc';
import { registerNotesIpc, registerReminderIpc } from './ipc/notes.ipc';
import { registerPageInfoIpc } from './ipc/page-info.ipc';
import { registerPanelIpc } from './ipc/panel.ipc';
import { registerScreenshotIpc } from './ipc/screenshot.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';
import { registerShortcutIpc } from './ipc/shortcuts.ipc';
import { registerSnippetIpc } from './ipc/snippets.ipc';
import { registerSuggestionIpc } from './ipc/suggestions.ipc';
import { registerVolumeIpc } from './ipc/volume.ipc';
import { registerWindowIpc } from './ipc/window.ipc';
import { registerZipIpc } from './ipc/zip.ipc';
import { ReminderScheduler } from './notes/reminder-scheduler';
import { AllowedAppRepository } from './repositories/allowed-app.repository';
import { NoteRepository } from './repositories/note.repository';
import { SettingsRepository } from './repositories/settings.repository';
import { ShortcutRepository } from './repositories/shortcut.repository';
import { SliceRepository } from './repositories/slice.repository';
import { SnippetRepository } from './repositories/snippet.repository';
import { SuggestionRepository } from './repositories/suggestion.repository';
import { seedFirstRun } from './services/first-run';
import { NoteService } from './services/note.service';
import { kindOfPath } from './services/path-kind';
import { SettingsService } from './services/settings.service';
import { ShortcutService } from './services/shortcut.service';
import { SliceService } from './services/slice.service';
import { SnippetService } from './services/snippet.service';
import { SuggestionService } from './services/suggestion.service';
import {
  OPEN_PIE_FLAG,
  installShellMenu,
  removeShellMenu,
} from './shell-menu/shell-menu';
import { setOpenKeys } from './shortcuts/open-keys';
import {
  openPieAtCursor,
  startShortcuts,
  stopShortcuts,
} from './shortcuts/shortcuts';
import { Startup } from './startup';
import { createTray } from './tray/tray';
import { isNavigationAllowed } from './windows/navigation';
import { openPanelWindow } from './windows/panel-window';
import {
  createPieWindow,
  setBeforePieOpens,
  setPiePin,
  setPieSize,
} from './windows/pie-window';
import {
  frontExplorerWindow,
  readExplorerSelection,
} from './zip/explorer-selection';
import { ZipSelection, defaultZipDeps } from './zip/zip-selection';
import { sendNotesChanged } from './windows/notes-window';
import {
  setCopiedAddressRule,
  setPageInfoOnTop,
} from './windows/page-info-window';
import { showReminders } from './windows/reminder-window';
import { limitPermissions } from './windows/permissions';
import { markQuitting } from './windows/quitting';
import { applySiteRules, isSiteSession } from './windows/site-window';

function startApp(): void {
  // Applies to every window the app ever creates: no pop-ups, no leaving the app.
  app.on('web-contents-created', (_event, contents) => {
    if (isSiteSession(contents.session)) {
      applySiteRules(contents);
      return;
    }
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event) => {
      if (!isNavigationAllowed(event.url, MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
        event.preventDefault();
      }
    });
  });

  app.on('before-quit', markQuitting);

  // Starting the app a second time brings up Settings in the running one, or
  // the donut when started from the Windows right-click menu.
  app.on('second-instance', (_event, argv) => {
    if (!app.isReady()) {
      return;
    }
    if (argv.includes(OPEN_PIE_FLAG)) {
      openPieAtCursor();
    } else {
      openPanelWindow();
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  const startup = new Startup();
  // Registered before anything starts, so a quit at any point stops what ran.
  app.on('will-quit', () => startup.cleanUp());

  app.whenReady().then(() =>
    startup.run(() => startRuntime(startup), {
      showError: (message) =>
        dialog.showErrorBox('Pie Launcher could not start', message),
      exit: (code) => app.exit(code),
    }),
  );
}

function startRuntime(startup: Startup): void {
  // Before any window loads. The site viewer's session has its own rules.
  limitPermissions(session.defaultSession);
  const { db, isNew } = openDatabase(
    path.join(app.getPath('userData'), 'pie.db'),
  );
  startup.onQuit(() => db.close());
  const allowedApps = new AllowedAppRepository(db);
  const shortcutRepository = new ShortcutRepository(db);
  const slices = new SliceService(
    new SliceRepository(db),
    allowedApps,
    kindOfPath,
    (target) => shell.openPath(target),
    (target) => shortcutRepository.findAppByTarget(target)?.label,
  );
  const shortcuts = new ShortcutService(
    shortcutRepository,
    allowedApps,
    kindOfPath,
    (target) => shell.openPath(target),
    (url) => shell.openExternal(url),
  );
  const snippets = new SnippetService(new SnippetRepository(db), (text) =>
    clipboard.writeText(text),
  );
  const notes = new NoteService(new NoteRepository(db));
  const reminders = new ReminderScheduler(notes, showReminders);
  startup.onQuit(() => reminders.stop());
  notes.onChanged(() => {
    reminders.refresh();
    sendNotesChanged();
  });
  const settingsRepository = new SettingsRepository(db);
  const settings = new SettingsService(settingsRepository);
  // A copied address is checked only if the Links list would offer it.
  setCopiedAddressRule((address) =>
    canOpen(address, readLinkFilter(settings.get().linkFilter)),
  );
  const pairing = new PairingCode(settingsRepository);
  const chromeBridge = startChromeBridge(pairing);
  startup.onQuit(() => void chromeBridge.stop());
  const suggestions = new SuggestionService(new SuggestionRepository(db));
  const suggestionSync = new SuggestionSync({
    list: () => suggestions.list(),
    isEnabled: () => settings.get().suggestionsInChrome === 'on',
    bridge: chromeBridge,
  });
  suggestions.onChanged(() => suggestionSync.push());
  const zipSelection = new ZipSelection({
    ...defaultZipDeps,
    frontExplorerWindow,
    readSelection: readExplorerSelection,
    announce: (zipFile, count) => {
      if (!Notification.isSupported()) {
        return;
      }
      const notice = new Notification({
        title: 'Zip saved',
        body: `${count} ${count === 1 ? 'image' : 'images'} in ${path.basename(zipFile)}. Click to show it.`,
        silent: true,
      });
      notice.on('click', () => shell.showItemInFolder(zipFile));
      notice.show();
    },
  });
  setBeforePieOpens(() => zipSelection.noteFrontWindow());

  if (isNew) {
    seedFirstRun(settings);
  }

  registerWindowIpc();
  registerShortcutIpc(shortcuts, slices);
  registerSnippetIpc(snippets);
  registerSuggestionIpc(suggestions);
  registerNotesIpc(notes);
  registerReminderIpc(notes);
  registerPageInfoIpc(settings);
  registerScreenshotIpc();
  registerZipIpc(zipSelection);
  registerSettingsIpc(settings, () => suggestionSync.push());
  registerPanelIpc(slices);
  registerVolumeIpc();
  registerChromeIpc(pairing, chromeBridge);

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

// Uninstalling: take the right-click menu entry away too.
if (
  process.platform === 'win32' &&
  process.argv.includes('--squirrel-uninstall')
) {
  removeShellMenu();
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
const shouldRun = !started && app.requestSingleInstanceLock();

if (shouldRun) {
  startApp();
} else {
  app.quit();
}
