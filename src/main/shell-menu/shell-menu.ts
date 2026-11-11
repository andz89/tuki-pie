import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Started with this, the app opens the donut instead of Settings.
export const OPEN_PIE_FLAG = '--open-pie';

// Right-clicking the desktop, and empty space inside a folder.
const MENU_KEYS = [
  'HKCU\\Software\\Classes\\DesktopBackground\\Shell\\PieLauncher',
  'HKCU\\Software\\Classes\\Directory\\Background\\Shell\\PieLauncher',
];

const MENU_LABEL = 'Open Pie Launcher';

// Arguments for each reg.exe call that adds the menu entries.
export function addMenuCommands(exe: string): string[][] {
  return MENU_KEYS.flatMap((key) => [
    ['add', key, '/ve', '/d', MENU_LABEL, '/f'],
    ['add', key, '/v', 'Icon', '/d', `"${exe}",0`, '/f'],
    ['add', `${key}\\command`, '/ve', '/d', `"${exe}" ${OPEN_PIE_FLAG}`, '/f'],
  ]);
}

export function removeMenuCommands(): string[][] {
  return MENU_KEYS.map((key) => ['delete', key, '/f']);
}

// Squirrel installs each version in its own app-x.y.z folder and keeps a
// launcher one folder up that always starts the newest one. Point at that.
export function launcherPath(execPath: string): string {
  const launcher = path.join(
    path.dirname(execPath),
    '..',
    path.basename(execPath),
  );
  return existsSync(launcher) ? path.resolve(launcher) : execPath;
}

export function installShellMenu(execPath: string): void {
  for (const args of addMenuCommands(launcherPath(execPath))) {
    execFile('reg.exe', args, { windowsHide: true }, (error) => {
      if (error) {
        console.warn(
          'Could not add the right-click menu entry:',
          error.message,
        );
      }
    });
  }
}

// Runs while uninstalling, which waits for nothing, so this is synchronous.
export function removeShellMenu(): void {
  for (const args of removeMenuCommands()) {
    try {
      execFileSync('reg.exe', args, { windowsHide: true, stdio: 'ignore' });
    } catch {
      // Already gone.
    }
  }
}
