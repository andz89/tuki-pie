import { describe, expect, it } from 'vitest';
import type { SuggestionGroup } from './types';
import {
  cleanText,
  moveItem,
  splitValues,
  toChromeSuggestions,
} from './suggestions';

describe('cleanText', () => {
  it('trims and turns line breaks and tabs into single spaces', () => {
    expect(cleanText('  a\r\nb\tc  ')).toBe('a b c');
  });

  it('keeps spaces inside the text', () => {
    expect(cleanText('New  York')).toBe('New  York');
  });
});

describe('splitValues', () => {
  it('splits on commas and drops blanks and repeats', () => {
    expect(splitValues('13, 02,, 00 ,13')).toEqual(['13', '02', '00']);
  });

  it('gives nothing for blank input', () => {
    expect(splitValues('  ,  ')).toEqual([]);
  });
});

describe('toChromeSuggestions', () => {
  const groups: SuggestionGroup[] = [
    {
      id: 'a',
      name: 'Day',
      collapsed: true,
      values: [
        { value: '01', label: null, hidden: false },
        { value: '13', label: 'Friday', hidden: false },
        { value: '31', label: null, hidden: true },
      ],
    },
    {
      id: 'b',
      name: 'Gone',
      collapsed: false,
      values: [{ value: 'x', label: null, hidden: true }],
    },
    { id: 'c', name: 'Empty', collapsed: false, values: [] },
  ];

  it('keeps only visible values and groups that still have one', () => {
    expect(toChromeSuggestions(groups, true)).toEqual({
      enabled: true,
      groups: [
        {
          name: 'Day',
          values: [{ value: '01' }, { value: '13', label: 'Friday' }],
        },
      ],
    });
  });

  it('passes the switch along', () => {
    expect(toChromeSuggestions([], false)).toEqual({
      enabled: false,
      groups: [],
    });
  });
});

describe('moveItem', () => {
  const list = ['a', 'b', 'c'];

  it('lands the item before the one now at the index', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'a', 'c']);
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('puts it last with the length as index', () => {
    expect(moveItem(list, 0, 3)).toEqual(['b', 'c', 'a']);
  });

  it('leaves the list alone for a bad index, and does not change it', () => {
    expect(moveItem(list, 5, 0)).toEqual(list);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});
