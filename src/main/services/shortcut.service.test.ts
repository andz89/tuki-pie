import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewShortcut } from '../../shared/types';
import { migrate } from '../db/migrate';
import { AllowedAppRepository } from '../repositories/allowed-app.repository';
import { ShortcutRepository } from '../repositories/shortcut.repository';
import type { PathKind } from './path-kind';
import { ShortcutService } from './shortcut.service';

const APP = 'C:\\Apps\\editor.exe';
const FOLDER = 'C:\\Work\\Current';
const NOTE = 'C:\\Notes\\Länkar.txt';

let db: Database.Database;
let kinds: Record<string, PathKind>;
let allowedApps: AllowedAppRepository;
let openPath: ReturnType<typeof vi.fn<(file: string) => Promise<string>>>;
let openExternal: ReturnType<typeof vi.fn<(url: string) => Promise<void>>>;
let service: ShortcutService;

const link = (label: string, parentId: string | null = null): NewShortcut => ({
  type: 'link',
  label,
  target: 'https://a.com',
  parentId,
});
const group: NewShortcut = {
  type: 'group',
  label: 'Group',
  target: null,
  parentId: null,
};
const app: NewShortcut = {
  type: 'app',
  label: 'Editor',
  target: APP,
  parentId: null,
};

function fillRow(parentId: string | null) {
  for (let n = 0; n < 8; n += 1) {
    service.add(link(`Link ${n}`, parentId));
  }
}

function addGroup(): string {
  return service.add(group).find((item) => item.type === 'group')!.id;
}

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);
  kinds = { [APP]: 'file' };
  allowedApps = new AllowedAppRepository(db);
  openPath = vi.fn(async () => '');
  openExternal = vi.fn(async () => undefined);
  service = new ShortcutService(
    new ShortcutRepository(db),
    allowedApps,
    (file) => kinds[file] ?? null,
    openPath,
    openExternal,
  );
});

describe('opening a shortcut', () => {
  it('opens a link in the browser', async () => {
    const [item] = service.add(link('Mail'));
    await service.open(item.id);
    expect(openExternal).toHaveBeenCalledExactlyOnceWith('https://a.com');
    expect(openPath).not.toHaveBeenCalled();
  });

  it('opens an allowed app', async () => {
    allowedApps.add(APP);
    const [item] = service.add(app);
    await service.open(item.id);
    expect(openPath).toHaveBeenCalledExactlyOnceWith(APP);
    expect(openExternal).not.toHaveBeenCalled();
  });

  it.each(['file:///C:/a', 'javascript:alert(1)'])(
    'refuses a stored link changed to %s',
    async (target) => {
      const [item] = service.add(link('Mail'));
      db.prepare('UPDATE shortcuts SET target = ?').run(target);
      await expect(service.open(item.id)).rejects.toThrow(
        'Links must start with http or https.',
      );
      expect(openExternal).not.toHaveBeenCalled();
    },
  );

  it('refuses an app no longer on the allowed list', async () => {
    allowedApps.add(APP);
    const [item] = service.add(app);
    allowedApps.remove(APP);
    await expect(service.open(item.id)).rejects.toThrow(
      'App not allowed. Check Settings.',
    );
    expect(openPath).not.toHaveBeenCalled();
  });

  it('explains when the app file is gone', async () => {
    allowedApps.add(APP);
    const [item] = service.add(app);
    delete kinds[APP];
    await expect(service.open(item.id)).rejects.toThrow(
      'Nothing found at that path. Fix it in Settings.',
    );
  });

  it.each([
    ['a folder', FOLDER, 'folder'],
    ['a note', NOTE, 'file'],
  ] as const)('opens %s', async (_name, target, kind) => {
    kinds[target] = kind;
    allowedApps.add(target);
    const [item] = service.add({ ...app, target });
    await service.open(item.id);
    expect(openPath).toHaveBeenCalledExactlyOnceWith(target);
  });

  it('explains when the browser could not open the link', async () => {
    const [item] = service.add(link('Mail'));
    openExternal.mockRejectedValue(new Error('no'));
    await expect(service.open(item.id)).rejects.toThrow('Could not open Mail.');
  });

  it('explains when Windows could not open the app', async () => {
    allowedApps.add(APP);
    const [item] = service.add(app);
    openPath.mockResolvedValue('failed');
    await expect(service.open(item.id)).rejects.toThrow(
      'Could not open Editor.',
    );
  });

  it('refuses to open a group', async () => {
    const id = addGroup();
    await expect(service.open(id)).rejects.toThrow(
      'That shortcut cannot be opened.',
    );
  });

  it('explains when the shortcut is gone', async () => {
    await expect(service.open('nope')).rejects.toThrow(
      'That shortcut no longer exists.',
    );
  });
});

describe('adding', () => {
  it('refuses a ninth item in a row', () => {
    fillRow(null);
    expect(() => service.add(link('Extra'))).toThrow(
      'This row can hold 8 shortcuts at most.',
    );
  });

  it('counts groups in the row', () => {
    addGroup();
    for (let n = 0; n < 7; n += 1) {
      service.add(link(`Link ${n}`));
    }
    expect(() => service.add(group)).toThrow(
      'This row can hold 8 shortcuts at most.',
    );
  });

  it('allows a group to fill up even when the top row is full', () => {
    const id = addGroup();
    for (let n = 0; n < 7; n += 1) {
      service.add(link(`Link ${n}`));
    }
    expect(() => service.add(link('Inside', id))).not.toThrow();
  });

  it('refuses a parent that is not a group', () => {
    const [item] = service.add(link('Mail'));
    expect(() => service.add(link('Inside', item.id))).toThrow(
      'That group no longer exists.',
    );
  });

  it('refuses a parent that does not exist', () => {
    expect(() => service.add(link('Inside', 'nope'))).toThrow(
      'That group no longer exists.',
    );
  });

  it('refuses an app that is not allowed', () => {
    expect(() => service.add(app)).toThrow('App not allowed. Check Settings.');
  });

  it('refuses an allowed app whose file is missing', () => {
    allowedApps.add(APP);
    delete kinds[APP];
    expect(() => service.add(app)).toThrow('Nothing found at that path.');
  });

  it.each(['notepad', 'Work\\notes.txt', 'C:notes.txt'])(
    'refuses %s because it is not a full path',
    (target) => {
      kinds[target] = 'file';
      allowedApps.add(target);
      expect(() => service.add({ ...app, target })).toThrow(
        'Enter a full path, like C:\\Folder\\file.txt.',
      );
    },
  );
});

describe('checking before approval', () => {
  it('passes a usable path that is not approved yet', () => {
    expect(() => service.assertCanAdd(app)).not.toThrow();
  });

  it('fails a path that does not exist', () => {
    delete kinds[APP];
    expect(() => service.assertCanAdd(app)).toThrow(
      'Nothing found at that path.',
    );
  });

  it('fails when the row is full', () => {
    fillRow(null);
    expect(() => service.assertCanAdd(link('Extra'))).toThrow(
      'This row can hold 8 shortcuts at most.',
    );
  });

  it('keeps apps apart: a full row of links leaves room for an app', () => {
    fillRow(null);
    expect(() => service.assertCanAdd(app)).not.toThrow();
  });

  it('does not put an app inside a group', () => {
    const groupId = addGroup();
    expect(() => service.assertCanAdd({ ...app, parentId: groupId })).toThrow(
      'Apps live in the Apps tab, not in a group.',
    );
  });

  it('fails a new path that does not exist on an edit', () => {
    allowedApps.add(APP);
    const [item] = service.add(app);
    expect(() =>
      service.assertCanUpdate({
        id: item.id,
        label: 'Editor',
        target: 'C:\\missing.exe',
      }),
    ).toThrow('Nothing found at that path.');
  });

  it('fails an edit of a shortcut that is gone', () => {
    expect(() =>
      service.assertCanUpdate({ id: 'nope', label: 'A', target: APP }),
    ).toThrow('That shortcut no longer exists.');
  });
});

describe('changing', () => {
  it('saves a new name and address', () => {
    const [item] = service.add(link('Mail'));
    const [saved] = service.update({
      id: item.id,
      label: 'Post',
      target: 'https://b.com',
    });
    expect(saved).toMatchObject({ label: 'Post', target: 'https://b.com' });
  });

  it('refuses a bad address and keeps the old one', () => {
    const [item] = service.add(link('Mail'));
    expect(() =>
      service.update({ id: item.id, label: 'Mail', target: 'file:///a' }),
    ).toThrow('Links must start with http or https.');
    expect(service.list()[0].target).toBe('https://a.com');
  });

  it('refuses an address on a group', () => {
    const id = addGroup();
    expect(() =>
      service.update({ id, label: 'G', target: 'https://a.com' }),
    ).toThrow('A group has no address.');
  });

  it('explains when the shortcut is gone', () => {
    expect(() =>
      service.update({ id: 'nope', label: 'A', target: 'https://a.com' }),
    ).toThrow('That shortcut no longer exists.');
  });
});

describe('removing and moving', () => {
  it('closes the gap left in a row', () => {
    service.add(link('A'));
    const [, middle] = service.add(link('B'));
    service.add(link('C'));
    const left = service.remove(middle.id);
    expect(left.map(({ label, position }) => [label, position])).toEqual([
      ['A', 0],
      ['C', 1],
    ]);
  });

  it('removes what is inside a group', () => {
    const id = addGroup();
    service.add(link('Inside', id));
    expect(service.remove(id)).toEqual([]);
  });

  it('reorders one row and leaves the others alone', () => {
    const id = addGroup();
    service.add(link('Top'));
    const inside = service.add(link('In A', id));
    const b = service.add(link('In B', id));
    const inA = inside.find(({ label }) => label === 'In A')!;
    const inB = b.find(({ label }) => label === 'In B')!;
    const moved = service.reorder(id, [inB.id, inA.id]);
    expect(
      moved.filter((item) => item.parentId === id).map(({ label }) => label),
    ).toEqual(['In B', 'In A']);
    expect(moved.filter((item) => item.parentId === null)).toHaveLength(2);
  });

  it.each([[[]], [['nope']]])('refuses a stale order %j', (ids) => {
    service.add(link('A'));
    expect(() => service.reorder(null, ids)).toThrow(
      'The shortcuts changed. Please try again.',
    );
  });
});

describe('moving to another row', () => {
  const labels = (items: { label: string }[]) =>
    items.map(({ label }) => label);
  const top = () => service.list().filter((item) => item.parentId === null);
  const inside = (id: string) =>
    service.list().filter((item) => item.parentId === id);
  const idOf = (label: string) =>
    service.list().find((item) => item.label === label)!.id;

  it('moves a link into a group, at the place asked', () => {
    const groupId = addGroup();
    service.add(link('In A', groupId));
    service.add(link('In B', groupId));
    service.add(link('Top'));
    service.move(idOf('Top'), groupId, 1);
    expect(labels(inside(groupId))).toEqual(['In A', 'Top', 'In B']);
    expect(labels(top())).toEqual(['Group']);
  });

  it('takes a link out of a group and closes the gap', () => {
    const groupId = addGroup();
    service.add(link('In A', groupId));
    service.add(link('In B', groupId));
    service.add(link('In C', groupId));
    service.move(idOf('In A'), null, 0);
    expect(labels(top())).toEqual(['In A', 'Group']);
    expect(inside(groupId).map(({ position }) => position)).toEqual([0, 1]);
  });

  it('moves along its own row like reorder does', () => {
    service.add(link('A'));
    service.add(link('B'));
    service.add(link('C'));
    service.move(idOf('A'), null, 2);
    expect(labels(top())).toEqual(['B', 'C', 'A']);
  });

  it('puts an index past the end at the end', () => {
    const groupId = addGroup();
    service.add(link('In A', groupId));
    service.add(link('Top'));
    service.move(idOf('Top'), groupId, 7);
    expect(labels(inside(groupId))).toEqual(['In A', 'Top']);
  });

  it('refuses to put a group inside a group', () => {
    const groupId = addGroup();
    const other = service.add({ ...group, label: 'Other' });
    const otherId = other.find(({ label }) => label === 'Other')!.id;
    expect(() => service.move(otherId, groupId, 0)).toThrow(
      'A group cannot go inside another group.',
    );
  });

  it('refuses to put a link inside a link', () => {
    service.add(link('A'));
    service.add(link('B'));
    expect(() => service.move(idOf('A'), idOf('B'), 0)).toThrow(
      'That group no longer exists.',
    );
  });

  it('refuses a full group', () => {
    const groupId = addGroup();
    fillRow(groupId);
    service.add(link('Top'));
    expect(() => service.move(idOf('Top'), groupId, 0)).toThrow(
      'This row can hold 8 shortcuts at most.',
    );
    expect(top()).toHaveLength(2);
  });

  it('refuses a shortcut that is gone', () => {
    expect(() => service.move('nope', null, 0)).toThrow(
      'That shortcut no longer exists.',
    );
  });
});
