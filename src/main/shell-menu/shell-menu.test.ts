import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addMenuCommands,
  launcherPath,
  removeMenuCommands,
} from './shell-menu';

vi.mock('node:fs', () => ({ existsSync: vi.fn() }));

const EXE = 'C:\\Users\\Me\\AppData\\Local\\pie_launcher\\Pie Launcher.exe';

beforeEach(() => {
  vi.mocked(existsSync).mockReset();
});

describe('addMenuCommands', () => {
  it('adds a labelled entry with an icon on the desktop and in folders', () => {
    const commands = addMenuCommands(EXE);
    for (const place of ['DesktopBackground', 'Directory\\Background']) {
      const key = `HKCU\\Software\\Classes\\${place}\\Shell\\PieLauncher`;
      expect(commands).toContainEqual([
        'add',
        key,
        '/ve',
        '/d',
        'Open Pie Launcher',
        '/f',
      ]);
      expect(commands).toContainEqual([
        'add',
        key,
        '/v',
        'Icon',
        '/d',
        `"${EXE}",0`,
        '/f',
      ]);
      expect(commands).toContainEqual([
        'add',
        `${key}\\command`,
        '/ve',
        '/d',
        `"${EXE}" --open-pie`,
        '/f',
      ]);
    }
  });
});

describe('removeMenuCommands', () => {
  it('deletes both entries', () => {
    expect(removeMenuCommands()).toEqual([
      [
        'delete',
        'HKCU\\Software\\Classes\\DesktopBackground\\Shell\\PieLauncher',
        '/f',
      ],
      [
        'delete',
        'HKCU\\Software\\Classes\\Directory\\Background\\Shell\\PieLauncher',
        '/f',
      ],
    ]);
  });
});

describe('launcherPath', () => {
  const installed =
    'C:\\Users\\Me\\AppData\\Local\\pie_launcher\\app-1.0.0\\Pie Launcher.exe';

  it('uses the launcher outside the version folder when there is one', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(launcherPath(installed)).toMatch(
      /pie_launcher[\\/]Pie Launcher\.exe$/,
    );
  });

  it('uses the app itself otherwise', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(launcherPath(installed)).toBe(installed);
  });
});
