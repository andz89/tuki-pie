import { describe, expect, it } from 'vitest';
import { SuggestionChange } from './suggestion.schema';

const ok = (change: unknown) => SuggestionChange.safeParse(change).success;

describe('SuggestionChange', () => {
  it('accepts each kind of change', () => {
    expect(ok({ kind: 'add-group', name: 'Day' })).toBe(true);
    expect(ok({ kind: 'rename-group', id: 'g', name: 'Days' })).toBe(true);
    expect(ok({ kind: 'remove-group', id: 'g' })).toBe(true);
    expect(ok({ kind: 'reorder-groups', ids: ['a', 'b'] })).toBe(true);
    expect(ok({ kind: 'collapse-group', id: 'g', collapsed: true })).toBe(true);
    expect(ok({ kind: 'hide-group', id: 'g', hidden: false })).toBe(true);
    expect(ok({ kind: 'add-values', groupId: 'g', text: '1, 2' })).toBe(true);
    expect(
      ok({
        kind: 'edit-value',
        groupId: 'g',
        value: '1',
        newValue: '01',
        label: '',
        toGroupId: 'h',
      }),
    ).toBe(true);
    expect(
      ok({ kind: 'hide-value', groupId: 'g', value: '1', hidden: true }),
    ).toBe(true);
    expect(
      ok({ kind: 'reorder-values', groupId: 'g', values: ['2', '1'] }),
    ).toBe(true);
    expect(ok({ kind: 'remove-value', groupId: 'g', value: '1' })).toBe(true);
  });

  it('refuses unknown kinds and missing fields', () => {
    expect(ok({ kind: 'run-script' })).toBe(false);
    expect(ok({ kind: 'rename-group', name: 'x' })).toBe(false);
    expect(ok({ kind: 'hide-value', groupId: 'g', value: '1' })).toBe(false);
  });

  it('refuses text past the limits', () => {
    expect(ok({ kind: 'add-group', name: 'x'.repeat(41) })).toBe(false);
    expect(
      ok({
        kind: 'edit-value',
        groupId: 'g',
        value: '1',
        newValue: 'x'.repeat(201),
        label: '',
        toGroupId: 'g',
      }),
    ).toBe(false);
    expect(
      ok({
        kind: 'edit-value',
        groupId: 'g',
        value: '1',
        newValue: '1',
        label: 'x'.repeat(41),
        toGroupId: 'g',
      }),
    ).toBe(false);
    expect(ok({ kind: 'reorder-groups', ids: Array(51).fill('a') })).toBe(
      false,
    );
  });
});
