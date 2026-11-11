import { beforeEach, describe, expect, it } from 'vitest';
import {
  SUGGESTIONS_KEY,
  createSuggestionStore,
  isSuggestionList,
} from './suggestions-store.js';

const GOOD = {
  enabled: true,
  groups: [
    { name: 'Day', values: [{ value: '01' }, { value: '13', label: 'Fri' }] },
  ],
};

let saved: Record<string, unknown>;
const storage = {
  set: async (items: Record<string, unknown>) => {
    Object.assign(saved, items);
  },
};

beforeEach(() => {
  saved = {};
});

describe('isSuggestionList', () => {
  it('accepts a good list, and an empty one', () => {
    expect(isSuggestionList(GOOD)).toBe(true);
    expect(isSuggestionList({ enabled: false, groups: [] })).toBe(true);
  });

  it.each([
    ['nothing', null],
    ['an array', []],
    ['no switch', { groups: [] }],
    ['a switch that is not true or false', { enabled: 'yes', groups: [] }],
    ['groups that are not a list', { enabled: true, groups: {} }],
    [
      'too many groups',
      { enabled: true, groups: Array(51).fill(GOOD.groups[0]) },
    ],
    [
      'a blank group name',
      { enabled: true, groups: [{ name: '', values: [{ value: 'a' }] }] },
    ],
    [
      'a long group name',
      {
        enabled: true,
        groups: [{ name: 'x'.repeat(41), values: [{ value: 'a' }] }],
      },
    ],
    [
      'too many values',
      {
        enabled: true,
        groups: [{ name: 'A', values: Array(201).fill({ value: 'a' }) }],
      },
    ],
    [
      'a blank value',
      { enabled: true, groups: [{ name: 'A', values: [{ value: '' }] }] },
    ],
    [
      'a long value',
      {
        enabled: true,
        groups: [{ name: 'A', values: [{ value: 'x'.repeat(201) }] }],
      },
    ],
    [
      'a value that is not text',
      { enabled: true, groups: [{ name: 'A', values: [{ value: 5 }] }] },
    ],
    [
      'a long label',
      {
        enabled: true,
        groups: [
          { name: 'A', values: [{ value: 'a', label: 'x'.repeat(41) }] },
        ],
      },
    ],
    [
      'a label that is not text',
      {
        enabled: true,
        groups: [{ name: 'A', values: [{ value: 'a', label: 1 }] }],
      },
    ],
  ])('refuses %s', (_name, list) => {
    expect(isSuggestionList(list)).toBe(false);
  });
});

describe('createSuggestionStore', () => {
  it('saves a good list, keeping only the known fields', async () => {
    await createSuggestionStore(storage).save({
      ...GOOD,
      extra: 'dropped',
      groups: [{ ...GOOD.groups[0], id: 'dropped' }],
    });
    expect(saved[SUGGESTIONS_KEY]).toEqual(GOOD);
  });

  it('refuses a bad list and keeps the old one', async () => {
    const store = createSuggestionStore(storage);
    await store.save(GOOD);
    await expect(store.save({ enabled: true, groups: 'x' })).rejects.toThrow();
    expect(saved[SUGGESTIONS_KEY]).toEqual(GOOD);
  });
});
