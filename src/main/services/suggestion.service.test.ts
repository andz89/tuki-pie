import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SuggestionGroup } from '../../shared/types';
import { migrate } from '../db/migrate';
import { SuggestionRepository } from '../repositories/suggestion.repository';
import { SuggestionService } from './suggestion.service';
import { UserError } from './user-error';

const GROUP_GONE = new UserError('That group no longer exists.');
const VALUE_GONE = new UserError('That value no longer exists.');
const CHANGED = new UserError('The suggestions changed. Please try again.');

let service: SuggestionService;

const names = (groups: SuggestionGroup[]) => groups.map((g) => g.name);
const values = (group: SuggestionGroup | undefined) =>
  group?.values.map((v) => v.value);
const byName = (name: string) =>
  service.list().find((group) => group.name === name);
const idOf = (name: string) => byName(name)?.id ?? 'missing';

function addGroup(name: string, text = ''): string {
  service.apply({ kind: 'add-group', name });
  const id = idOf(name);
  if (text) {
    service.apply({ kind: 'add-values', groupId: id, text });
  }
  return id;
}

beforeEach(() => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);
  service = new SuggestionService(new SuggestionRepository(db));
});

describe('groups', () => {
  it('adds groups in order, open and empty', () => {
    addGroup('Day');
    const list = service.apply({ kind: 'add-group', name: '  Month\n' });
    expect(names(list)).toEqual(['Day', 'Month']);
    expect(list[1]).toMatchObject({ collapsed: false, values: [] });
  });

  it('names a blank new group "New group"', () => {
    expect(names(service.apply({ kind: 'add-group', name: ' ' }))).toEqual([
      'New group',
    ]);
  });

  it('refuses a 51st group', () => {
    for (let n = 0; n < 50; n += 1) {
      service.apply({ kind: 'add-group', name: `G${n}` });
    }
    expect(() => service.apply({ kind: 'add-group', name: 'More' })).toThrow(
      new UserError('You can have 50 groups at most.'),
    );
  });

  it('renames, and a blank name keeps the old one', () => {
    const id = addGroup('Day');
    service.apply({ kind: 'rename-group', id, name: 'Days' });
    expect(
      names(service.apply({ kind: 'rename-group', id, name: '  ' })),
    ).toEqual(['Days']);
  });

  it('removes a group with its values and closes the gap', () => {
    addGroup('A', '1');
    const b = addGroup('B', '2');
    addGroup('C');
    expect(names(service.apply({ kind: 'remove-group', id: b }))).toEqual([
      'A',
      'C',
    ]);
    const ids = service.list().map((g) => g.id);
    expect(
      names(service.apply({ kind: 'reorder-groups', ids: [...ids].reverse() })),
    ).toEqual(['C', 'A']);
  });

  it('reorders, and refuses a list that no longer matches', () => {
    const a = addGroup('A');
    const b = addGroup('B');
    expect(
      names(service.apply({ kind: 'reorder-groups', ids: [b, a] })),
    ).toEqual(['B', 'A']);
    expect(() => service.apply({ kind: 'reorder-groups', ids: [a] })).toThrow(
      CHANGED,
    );
    expect(() =>
      service.apply({ kind: 'reorder-groups', ids: [a, a] }),
    ).toThrow(CHANGED);
  });

  it('folds and unfolds', () => {
    const id = addGroup('A');
    service.apply({ kind: 'collapse-group', id, collapsed: true });
    expect(byName('A')?.collapsed).toBe(true);
  });

  it('hides and shows every value', () => {
    const id = addGroup('A', '1, 2');
    service.apply({ kind: 'hide-group', id, hidden: true });
    expect(byName('A')?.values.every((v) => v.hidden)).toBe(true);
    service.apply({ kind: 'hide-group', id, hidden: false });
    expect(byName('A')?.values.some((v) => v.hidden)).toBe(false);
  });

  it('reports a group that is gone', () => {
    expect(() =>
      service.apply({ kind: 'rename-group', id: 'x', name: 'y' }),
    ).toThrow(GROUP_GONE);
    expect(() => service.apply({ kind: 'remove-group', id: 'x' })).toThrow(
      GROUP_GONE,
    );
    expect(() =>
      service.apply({ kind: 'add-values', groupId: 'x', text: '1' }),
    ).toThrow(GROUP_GONE);
  });
});

describe('values', () => {
  it('adds a comma list after the existing values, skipping ones it has', () => {
    const id = addGroup('Day', '01');
    const list = service.apply({
      kind: 'add-values',
      groupId: id,
      text: '13, 01, 02 ,13',
    });
    expect(values(list[0])).toEqual(['01', '13', '02']);
    expect(list[0].values[1]).toEqual({
      value: '13',
      label: null,
      hidden: false,
    });
  });

  it('lets a value be in more than one group', () => {
    addGroup('A', '1');
    addGroup('B', '1');
    expect(values(byName('B'))).toEqual(['1']);
  });

  it('refuses going past 200 values, adding none', () => {
    const id = addGroup('A');
    const many = Array.from({ length: 199 }, (_, n) => `v${n}`).join(',');
    service.apply({ kind: 'add-values', groupId: id, text: many });
    expect(() =>
      service.apply({ kind: 'add-values', groupId: id, text: 'x, y' }),
    ).toThrow(new UserError('A group can hold 200 values at most.'));
    expect(byName('A')?.values).toHaveLength(199);
  });

  it('refuses a value longer than 200 characters', () => {
    const id = addGroup('A');
    expect(() =>
      service.apply({ kind: 'add-values', groupId: id, text: 'x'.repeat(201) }),
    ).toThrow(new UserError('A value can be 200 characters at most.'));
  });

  it('edits text and label in place', () => {
    const id = addGroup('Day', '1, 2');
    const list = service.apply({
      kind: 'edit-value',
      groupId: id,
      value: '1',
      newValue: ' 01 ',
      label: ' Monday ',
      toGroupId: id,
    });
    expect(list[0].values).toEqual([
      { value: '01', label: 'Monday', hidden: false },
      { value: '2', label: null, hidden: false },
    ]);
  });

  it('keeps the old text when the new one is blank, and clears a blank label', () => {
    const id = addGroup('Day', '1');
    service.apply({
      kind: 'edit-value',
      groupId: id,
      value: '1',
      newValue: '1',
      label: 'One',
      toGroupId: id,
    });
    const list = service.apply({
      kind: 'edit-value',
      groupId: id,
      value: '1',
      newValue: '  ',
      label: ' ',
      toGroupId: id,
    });
    expect(list[0].values).toEqual([
      { value: '1', label: null, hidden: false },
    ]);
  });

  it('refuses renaming to a value the group already has', () => {
    const id = addGroup('Day', '1, 2');
    expect(() =>
      service.apply({
        kind: 'edit-value',
        groupId: id,
        value: '1',
        newValue: '2',
        label: '',
        toGroupId: id,
      }),
    ).toThrow(new UserError('Day already has 2.'));
  });

  it('moves a value to the end of another group with its label and hidden mark', () => {
    const day = addGroup('Day', '1, 2');
    const month = addGroup('Month', 'Jan');
    service.apply({
      kind: 'hide-value',
      groupId: day,
      value: '2',
      hidden: true,
    });
    service.apply({
      kind: 'edit-value',
      groupId: day,
      value: '2',
      newValue: '2',
      label: 'Feb',
      toGroupId: month,
    });
    expect(values(byName('Day'))).toEqual(['1']);
    expect(byName('Month')?.values).toEqual([
      { value: 'Jan', label: null, hidden: false },
      { value: '2', label: 'Feb', hidden: true },
    ]);
  });

  it('merges into a group that already has the value, keeping its marks', () => {
    const a = addGroup('A', '1');
    const b = addGroup('B', '1, 2');
    service.apply({
      kind: 'edit-value',
      groupId: a,
      value: '1',
      newValue: '1',
      label: 'From A',
      toGroupId: b,
    });
    expect(values(byName('A'))).toEqual([]);
    expect(byName('B')?.values).toEqual([
      { value: '1', label: null, hidden: false },
      { value: '2', label: null, hidden: false },
    ]);
  });

  it('refuses moving into a full group', () => {
    const a = addGroup('A', 'x');
    const b = addGroup('B');
    const many = Array.from({ length: 200 }, (_, n) => `v${n}`).join(',');
    service.apply({ kind: 'add-values', groupId: b, text: many });
    expect(() =>
      service.apply({
        kind: 'edit-value',
        groupId: a,
        value: 'x',
        newValue: 'x',
        label: '',
        toGroupId: b,
      }),
    ).toThrow(new UserError('A group can hold 200 values at most.'));
    expect(values(byName('A'))).toEqual(['x']);
  });

  it('hides and shows one value', () => {
    const id = addGroup('A', '1, 2');
    service.apply({
      kind: 'hide-value',
      groupId: id,
      value: '2',
      hidden: true,
    });
    expect(byName('A')?.values.map((v) => v.hidden)).toEqual([false, true]);
  });

  it('reorders, and refuses a list that no longer matches', () => {
    const id = addGroup('A', '1, 2, 3');
    expect(
      values(
        service.apply({
          kind: 'reorder-values',
          groupId: id,
          values: ['3', '1', '2'],
        })[0],
      ),
    ).toEqual(['3', '1', '2']);
    expect(() =>
      service.apply({
        kind: 'reorder-values',
        groupId: id,
        values: ['1', '2'],
      }),
    ).toThrow(CHANGED);
  });

  it('removes a value', () => {
    const id = addGroup('A', '1, 2');
    expect(
      values(
        service.apply({ kind: 'remove-value', groupId: id, value: '1' })[0],
      ),
    ).toEqual(['2']);
  });

  it('reports a value that is gone', () => {
    const id = addGroup('A', '1');
    expect(() =>
      service.apply({ kind: 'remove-value', groupId: id, value: '9' }),
    ).toThrow(VALUE_GONE);
    expect(() =>
      service.apply({
        kind: 'hide-value',
        groupId: id,
        value: '9',
        hidden: true,
      }),
    ).toThrow(VALUE_GONE);
  });
});

describe('onChanged', () => {
  it('tells listeners after a change, not after a refused one', () => {
    const listener = vi.fn();
    service.onChanged(listener);
    addGroup('A');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(() => service.apply({ kind: 'remove-group', id: 'x' })).toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('moving a value by dragging', () => {
  it('moves within a group, landing before the value now at the index', () => {
    const id = addGroup('A', '1, 2, 3');
    const move = (value: string, index: number) =>
      values(
        service.apply({
          kind: 'move-value',
          groupId: id,
          value,
          toGroupId: id,
          index,
        })[0],
      );
    expect(move('1', 3)).toEqual(['2', '3', '1']);
    expect(move('1', 0)).toEqual(['1', '2', '3']);
    expect(move('3', 1)).toEqual(['1', '3', '2']);
  });

  it('moves into another group at the index, with its label and hidden mark', () => {
    const a = addGroup('A', '1, 2');
    const b = addGroup('B', 'x, y');
    service.apply({
      kind: 'edit-value',
      groupId: a,
      value: '2',
      newValue: '2',
      label: 'Two',
      toGroupId: a,
    });
    service.apply({ kind: 'hide-value', groupId: a, value: '2', hidden: true });
    service.apply({
      kind: 'move-value',
      groupId: a,
      value: '2',
      toGroupId: b,
      index: 1,
    });
    expect(values(byName('A'))).toEqual(['1']);
    expect(byName('B')?.values).toEqual([
      { value: 'x', label: null, hidden: false },
      { value: '2', label: 'Two', hidden: true },
      { value: 'y', label: null, hidden: false },
    ]);
  });

  it('merges into a group that already has the value', () => {
    const a = addGroup('A', '1');
    const b = addGroup('B', '1, 2');
    service.apply({
      kind: 'move-value',
      groupId: a,
      value: '1',
      toGroupId: b,
      index: 2,
    });
    expect(values(byName('A'))).toEqual([]);
    expect(values(byName('B'))).toEqual(['1', '2']);
  });

  it('refuses moving into a full group', () => {
    const a = addGroup('A', 'x');
    const b = addGroup('B');
    const many = Array.from({ length: 200 }, (_, n) => `v${n}`).join(',');
    service.apply({ kind: 'add-values', groupId: b, text: many });
    expect(() =>
      service.apply({
        kind: 'move-value',
        groupId: a,
        value: 'x',
        toGroupId: b,
        index: 0,
      }),
    ).toThrow(new UserError('A group can hold 200 values at most.'));
  });

  it('reports a value or group that is gone', () => {
    const a = addGroup('A', '1');
    expect(() =>
      service.apply({
        kind: 'move-value',
        groupId: a,
        value: '9',
        toGroupId: a,
        index: 0,
      }),
    ).toThrow(VALUE_GONE);
    expect(() =>
      service.apply({
        kind: 'move-value',
        groupId: a,
        value: '1',
        toGroupId: 'x',
        index: 0,
      }),
    ).toThrow(GROUP_GONE);
  });
});
