import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Shortcut, Slice } from '../../shared/types';
import { migrate } from '../db/migrate';
import { AllowedAppRepository } from './allowed-app.repository';
import { SettingsRepository } from './settings.repository';
import { ShortcutRepository } from './shortcut.repository';
import { SliceRepository } from './slice.repository';

function shortcut(id: string, overrides: Partial<Shortcut> = {}): Shortcut {
  return {
    id,
    label: id,
    type: 'link',
    target: 'https://a.com',
    parentId: null,
    position: 0,
    ...overrides,
  };
}

function slice(position: number, id = `id-${position}`): Slice {
  return {
    id,
    label: `Slice ${position}`,
    type: 'folder',
    path: `C:\\Folder ${position}`,
    position,
  };
}

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
});

describe('ShortcutRepository', () => {
  let shortcuts: ShortcutRepository;
  const group = shortcut('g', { type: 'group', target: null });

  beforeEach(() => {
    shortcuts = new ShortcutRepository(db);
  });

  it('counts each row separately', () => {
    shortcuts.insert(group);
    shortcuts.insert(shortcut('a', { parentId: 'g' }));
    shortcuts.insert(shortcut('b', { parentId: 'g', position: 1 }));
    expect(shortcuts.countIn(null)).toBe(1);
    expect(shortcuts.countIn('g')).toBe(2);
  });

  it('removes what is inside a group along with it', () => {
    shortcuts.insert(group);
    shortcuts.insert(shortcut('a', { parentId: 'g' }));
    shortcuts.remove('g');
    expect(shortcuts.findAll()).toEqual([]);
  });

  it('returns each row in position order', () => {
    shortcuts.insert(shortcut('second', { position: 1 }));
    shortcuts.insert(shortcut('first', { position: 0 }));
    expect(shortcuts.findAll().map(({ id }) => id)).toEqual([
      'first',
      'second',
    ]);
  });

  it('finds an app inside a group, but not a link with the same text', () => {
    shortcuts.insert(group);
    shortcuts.insert(shortcut('link', { target: 'C:\\a.exe' }));
    expect(shortcuts.findAppByTarget('C:\\a.exe')).toBeUndefined();
    shortcuts.insert(
      shortcut('app', { type: 'app', target: 'C:\\a.exe', parentId: 'g' }),
    );
    expect(shortcuts.findAppByTarget('C:\\a.exe')?.id).toBe('app');
  });

  it('saves a new name and address', () => {
    shortcuts.insert(shortcut('a'));
    shortcuts.update({ id: 'a', label: 'New', target: 'https://b.com' });
    expect(shortcuts.findById('a')).toMatchObject({
      label: 'New',
      target: 'https://b.com',
    });
  });

  it('sets a new order', () => {
    shortcuts.insert(shortcut('a'));
    shortcuts.insert(shortcut('b', { position: 1 }));
    shortcuts.setOrder(['b', 'a']);
    expect(shortcuts.findAll().map(({ id }) => id)).toEqual(['b', 'a']);
  });
});

describe('SliceRepository', () => {
  let slices: SliceRepository;

  beforeEach(() => {
    slices = new SliceRepository(db);
  });

  it('returns slices in position order', () => {
    slices.insert(slice(1));
    slices.insert(slice(0));
    expect(slices.findAll().map((item) => item.position)).toEqual([0, 1]);
  });

  it('finds one slice by id', () => {
    slices.insert(slice(0));
    expect(slices.findById('id-0')).toEqual(slice(0));
  });

  it('returns null for an unknown id', () => {
    expect(slices.findById('nope')).toBeNull();
  });

  it('updates a slice without moving it', () => {
    slices.insert(slice(0));
    slices.update({
      id: 'id-0',
      label: 'New',
      type: 'note',
      path: 'C:\\n.txt',
    });
    expect(slices.findById('id-0')).toEqual({
      id: 'id-0',
      label: 'New',
      type: 'note',
      path: 'C:\\n.txt',
      position: 0,
    });
  });

  it('removes a slice', () => {
    slices.insert(slice(0));
    slices.remove('id-0');
    expect(slices.findAll()).toEqual([]);
  });

  it('counts slices', () => {
    slices.insert(slice(0));
    slices.insert(slice(1));
    expect(slices.count()).toBe(2);
  });

  it('reorders slices despite positions having to be unique', () => {
    slices.insert(slice(0, 'a'));
    slices.insert(slice(1, 'b'));
    slices.insert(slice(2, 'c'));
    slices.setOrder(['c', 'a', 'b']);
    expect(slices.findAll().map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(slices.findAll().map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it('treats text in a path as data, not as SQL', () => {
    const tricky = { ...slice(0), path: "C:\\x'); DROP TABLE slices; --" };
    slices.insert(tricky);
    expect(slices.findById(tricky.id)?.path).toBe(tricky.path);
  });

  it('rejects a damaged row instead of returning it', () => {
    db.prepare(
      "INSERT INTO slices (id, label, type, path, position) VALUES ('x', ?, 'app', 'p', 0)",
    ).run('y'.repeat(25));
    expect(() => slices.findAll()).toThrow();
  });
});

describe('SettingsRepository', () => {
  it('stores and replaces values', () => {
    const settings = new SettingsRepository(db);
    settings.set('theme', 'dark');
    settings.set('theme', 'light');
    settings.set('accent', '#2563EB');
    expect(settings.getAll()).toEqual({ theme: 'light', accent: '#2563EB' });
  });
});

describe('AllowedAppRepository', () => {
  let allowedApps: AllowedAppRepository;

  beforeEach(() => {
    allowedApps = new AllowedAppRepository(db);
  });

  it('adds a path once, even if added twice', () => {
    allowedApps.add('C:\\a.exe');
    allowedApps.add('C:\\a.exe');
    expect(allowedApps.findAll()).toEqual(['C:\\a.exe']);
  });

  it('knows whether a path is allowed', () => {
    allowedApps.add('C:\\a.exe');
    expect(allowedApps.has('C:\\a.exe')).toBe(true);
    expect(allowedApps.has('C:\\b.exe')).toBe(false);
  });

  it('removes a path', () => {
    allowedApps.add('C:\\a.exe');
    allowedApps.remove('C:\\a.exe');
    expect(allowedApps.findAll()).toEqual([]);
  });
});
