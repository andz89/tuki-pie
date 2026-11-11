import { app, dialog, session } from 'electron';
import started from 'electron-squirrel-startup';
import { buildServices } from './app/build-services';
import { registerIpc } from './app/register-ipc';
import { startRuntime } from './app/start-runtime';
import { OPEN_PIE_FLAG, removeShellMenu } from './shell-menu/shell-menu';
import { openPieAtCursor } from './shortcuts/shortcuts';
import { Startup } from './startup';
import { isNavigationAllowed } from './windows/navigation';
import { openPanelWindow } from './windows/panel-window';
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
    startup.run(() => start(startup), {
      showError: (message) =>
        dialog.showErrorBox('Pie Launcher could not start', message),
      exit: (code) => app.exit(code),
    }),
  );
}

// In this order: services before the messages that use them, and both
// before any window can send one.
function start(startup: Startup): void {
  // Before any window loads. The site viewer's session has its own rules.
  limitPermissions(session.defaultSession);
  const services = buildServices(startup);
  registerIpc(services);
  startRuntime(startup, services);
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
