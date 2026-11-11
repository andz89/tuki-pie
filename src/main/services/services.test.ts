import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewSlice } from '../../shared/types';
import { migrate } from '../db/migrate';
import { AllowedAppRepository } from '../repositories/allowed-app.repository';
import { SettingsRepository } from '../repositories/settings.repository';
import { SliceRepository } from '../repositories/slice.repository';
import { seedFirstRun } from './first-run';
import { kindOfPath } from './path-kind';
import { SettingsService } from './settings.service';
import { SliceService } from './slice.service';
import type { PathKind } from './path-kind';

const FOLDER = 'C:\\Work';
const APP = 'C:\\Apps\\editor.exe';
const NOTE = 'C:\\Notes\\ideas.txt';

let kinds: Record<string, PathKind>;
let openPath: ReturnType<typeof vi.fn<(file: string) => Promise<string>>>;
let service: SliceService;
let allowedApps: AllowedAppRepository;
let settings: SettingsService;

const folder = (n: number): NewSlice => {
  const file = `C:\\Folder ${n}`;
  kinds[file] = 'folder';
  return { label: `Folder ${n}`, type: 'folder', path: file };
};

beforeEach(() => {
  const db = new Database(':memory:');
  migrate(db);
  kinds = { [FOLDER]: 'folder', [APP]: 'file', [NOTE]: 'file' };
  openPath = vi.fn(async () => '');
  allowedApps = new AllowedAppRepository(db);
  service = new SliceService(
    new SliceRepository(db),
    allowedApps,
    (file) => kinds[file] ?? null,
    openPath,
  );
  settings = new SettingsService(new SettingsRepository(db));
});

describe('an app that a shortcut uses', () => {
  it('cannot be removed from the allowed list', () => {
    const guarded = new SliceService(
      new SliceRepository(new Database(':memory:')),
      allowedApps,
      () => null,
      openPath,
      (file) => (file === APP ? 'Editor link' : undefined),
    );
    vi.spyOn(guarded, 'list').mockReturnValue([]);
    expect(() => guarded.removeAllowedApp(APP)).toThrow(
      'Editor link still uses this app. Remove that shortcut first.',
    );
  });
});

describe('opening a slice', () => {
  it('opens a folder', async () => {
    const [slice] = service.add({
      label: 'Work',
      type: 'folder',
      path: FOLDER,
    });
    await service.openSlice(slice.id);
    expect(openPath).toHaveBeenCalledExactlyOnceWith(FOLDER);
  });

  it('opens an allowed app', async () => {
    service.allowApp(APP);
    const [slice] = service.add({ label: 'Editor', type: 'app', path: APP });
    await service.openSlice(slice.id);
    expect(openPath).toHaveBeenCalledExactlyOnceWith(APP);
  });

  it('opens a note', async () => {
    const [slice] = service.add({ label: 'Ideas', type: 'note', path: NOTE });
    await service.openSlice(slice.id);
    expect(openPath).toHaveBeenCalledExactlyOnceWith(NOTE);
  });

  it('explains when a saved folder is gone', async () => {
    const [slice] = service.add({
      label: 'Work',
      type: 'folder',
      path: FOLDER,
    });
    delete kinds[FOLDER];
    await expect(service.openSlice(slice.id)).rejects.toThrow(
      'Folder not found. Fix it in Settings.',
    );
    expect(openPath).not.toHaveBeenCalled();
  });

  it('explains when a saved note is gone', async () => {
    const [slice] = service.add({ label: 'Ideas', type: 'note', path: NOTE });
    delete kinds[NOTE];
    await expect(service.openSlice(slice.id)).rejects.toThrow(
      'Note not found. Fix it in Settings.',
    );
  });

  it('refuses an app that is no longer allowed', async () => {
    service.allowApp(APP);
    const [slice] = service.add({ label: 'Editor', type: 'app', path: APP });
    allowedApps.remove(APP);
    await expect(service.openSlice(slice.id)).rejects.toThrow(
      'App not allowed. Check Settings.',
    );
    expect(openPath).not.toHaveBeenCalled();
  });

  it('reports when Windows cannot open the item', async () => {
    const [slice] = service.add({
      label: 'Work',
      type: 'folder',
      path: FOLDER,
    });
    openPath.mockResolvedValue('Access denied');
    await expect(service.openSlice(slice.id)).rejects.toThrow(
      'Could not open Work.',
    );
  });

  it('refuses an id that is not in the database', async () => {
    await expect(service.openSlice('C:\\Windows\\evil.exe')).rejects.toThrow(
      'That slice no longer exists.',
    );
    expect(openPath).not.toHaveBeenCalled();
  });
});

describe('adding a slice', () => {
  it('puts new slices at the end', () => {
    service.add(folder(1));
    const slices = service.add(folder(2));
    expect(slices.map((slice) => [slice.label, slice.position])).toEqual([
      ['Folder 1', 0],
      ['Folder 2', 1],
    ]);
  });

  it('gives each slice its own id', () => {
    service.add(folder(1));
    const [first, second] = service.add(folder(2));
    expect(first.id).not.toBe(second.id);
  });

  it('refuses a ninth slice', () => {
    for (let n = 1; n <= 8; n++) service.add(folder(n));
    expect(() => service.add(folder(9))).toThrow(
      'The donut can hold 8 slices at most.',
    );
  });

  it('refuses an app that is not allowed', () => {
    expect(() =>
      service.add({ label: 'Editor', type: 'app', path: APP }),
    ).toThrow('App not allowed. Check Settings.');
  });

  it('refuses a path that does not exist', () => {
    expect(() =>
      service.add({ label: 'Gone', type: 'folder', path: 'C:\\Gone' }),
    ).toThrow('Folder not found.');
  });

  it('refuses a file saved as a folder', () => {
    expect(() =>
      service.add({ label: 'Bad', type: 'folder', path: NOTE }),
    ).toThrow('Folder not found.');
  });

  it('refuses a folder saved as a note', () => {
    expect(() =>
      service.add({ label: 'Bad', type: 'note', path: FOLDER }),
    ).toThrow('Note not found.');
  });

  it.each(['run.exe', 'run.BAT', 'run.cmd', 'run.ps1', 'run.lnk', 'run.msi'])(
    'refuses %s as a note, so it cannot skip the allowed-apps list',
    (name) => {
      const file = `C:\\Notes\\${name}`;
      kinds[file] = 'file';
      expect(() =>
        service.add({ label: 'Sneaky', type: 'note', path: file }),
      ).toThrow('That file is a program, so add it as an App.');
    },
  );

  it.each(['page.html', 'script.py', 'macro.xlsm', 'link.website', 'run'])(
    'refuses %s as a note, as only documents count',
    (name) => {
      const file = `C:\\Notes\\${name}`;
      kinds[file] = 'file';
      expect(() =>
        service.add({ label: 'Odd', type: 'note', path: file }),
      ).toThrow('Notes can be text, Word, OpenDocument or PDF files.');
    },
  );

  it.each(['ideas.md', 'plan.DOCX', 'scan.pdf', 'letter.odt', 'old.rtf'])(
    'takes %s as a note',
    (name) => {
      const file = `C:\\Notes\\${name}`;
      kinds[file] = 'file';
      expect(() =>
        service.add({ label: 'Doc', type: 'note', path: file }),
      ).not.toThrow();
    },
  );
});

describe('changing slices', () => {
  it('updates a slice and keeps its place', () => {
    service.add(folder(1));
    const [first] = service.add(folder(2));
    const slices = service.update({
      id: first.id,
      label: 'Renamed',
      type: 'folder',
      path: FOLDER,
    });
    expect(slices[0]).toMatchObject({
      label: 'Renamed',
      path: FOLDER,
      position: 0,
    });
  });

  it('refuses to point a slice at an app that is not allowed', () => {
    const [first] = service.add(folder(1));
    expect(() =>
      service.update({ id: first.id, label: 'X', type: 'app', path: APP }),
    ).toThrow('App not allowed. Check Settings.');
  });

  it('refuses to update a slice that is gone', () => {
    expect(() =>
      service.update({ id: 'x', label: 'X', type: 'folder', path: FOLDER }),
    ).toThrow('That slice no longer exists.');
  });

  it('closes the gap after removing a slice', () => {
    service.add(folder(1));
    service.add(folder(2));
    const slices = service.add(folder(3));
    const remaining = service.remove(slices[1].id);
    expect(remaining.map((slice) => [slice.label, slice.position])).toEqual([
      ['Folder 1', 0],
      ['Folder 3', 1],
    ]);
  });

  it('refuses to go below two slices', () => {
    service.add(folder(1));
    const slices = service.add(folder(2));
    expect(() => service.remove(slices[0].id)).toThrow(
      'The donut needs at least 2 slices.',
    );
  });

  it('reorders slices', () => {
    service.add(folder(1));
    const slices = service.add(folder(2));
    const reordered = service.reorder([slices[1].id, slices[0].id]);
    expect(reordered.map((slice) => slice.label)).toEqual([
      'Folder 2',
      'Folder 1',
    ]);
  });

  it('refuses an order that does not list every slice exactly once', () => {
    service.add(folder(1));
    const slices = service.add(folder(2));
    expect(() => service.reorder([slices[0].id, slices[0].id])).toThrow(
      'The slices changed. Please try again.',
    );
  });
});

describe('allowed apps', () => {
  it('lists allowed apps', () => {
    service.allowApp(APP);
    expect(service.listAllowedApps()).toEqual([APP]);
  });

  it('removes an app no slice uses', () => {
    service.allowApp(APP);
    expect(service.removeAllowedApp(APP)).toEqual([]);
  });

  it('removes an app even when an old slice points at it', () => {
    service.allowApp(APP);
    service.add({ label: 'Editor', type: 'app', path: APP });
    expect(service.removeAllowedApp(APP)).toEqual([]);
  });
});

describe('settings', () => {
  it('starts with the defaults', () => {
    expect(settings.get()).toEqual({
      theme: 'dark',
      accent: '#2563EB',
      size: 'medium',
      pin: 'unpinned',
      pageInfoOnTop: 'normal',
      openKeys: 'Ctrl+Alt+Space',
      linkFilter: '{"off":[],"words":[],"tokens":true}',
      suggestionsInChrome: 'on',
    });
  });

  it('saves one change and keeps the rest', () => {
    expect(settings.update({ theme: 'light' })).toEqual({
      theme: 'light',
      accent: '#2563EB',
      size: 'medium',
      pin: 'unpinned',
      pageInfoOnTop: 'normal',
      openKeys: 'Ctrl+Alt+Space',
      linkFilter: '{"off":[],"words":[],"tokens":true}',
      suggestionsInChrome: 'on',
    });
    expect(settings.get().theme).toBe('light');
  });

  it('remembers that the donut is pinned', () => {
    settings.update({ pin: 'pinned' });
    expect(settings.get().pin).toBe('pinned');
  });

  it('falls back to the default for one stored value that no longer fits', () => {
    const db = new Database(':memory:');
    migrate(db);
    const repository = new SettingsRepository(db);
    repository.set('size', 'huge');
    repository.set('theme', 'light');
    const loaded = new SettingsService(repository).get();
    expect(loaded.size).toBe('medium');
    expect(loaded.theme).toBe('light');
  });

  it('ignores stored keys the app no longer knows', () => {
    const db = new Database(':memory:');
    migrate(db);
    const repository = new SettingsRepository(db);
    repository.set('retired', 'x');
    expect(new SettingsService(repository).get()).not.toHaveProperty('retired');
  });
});

describe('first run', () => {
  it('saves the default look', () => {
    settings.update({ theme: 'light' });
    seedFirstRun(settings);
    expect(settings.get().theme).toBe('dark');
  });

  it('adds no slices or allowed apps', () => {
    seedFirstRun(settings);
    expect(service.list()).toEqual([]);
    expect(service.listAllowedApps()).toEqual([]);
  });
});

describe('kindOfPath', () => {
  const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pie-kind-'));
  const filePath = path.join(folderPath, 'file.txt');
  fs.writeFileSync(filePath, 'x');

  it('recognises a folder', () => {
    expect(kindOfPath(folderPath)).toBe('folder');
  });

  it('recognises a file', () => {
    expect(kindOfPath(filePath)).toBe('file');
  });

  it('returns null for a missing path', () => {
    expect(kindOfPath(path.join(folderPath, 'missing'))).toBeNull();
  });
});
