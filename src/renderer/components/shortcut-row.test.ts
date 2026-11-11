import { describe, expect, it } from 'vitest';
import type { Shortcut } from '../../shared/types';
import { firstLetter, shortcutDetail, shortcutTree } from './shortcut-row';

const top: Shortcut = {
  id: 't',
  label: 'Top',
  type: 'link',
  target: 'https://a.com',
  parentId: null,
  position: 0,
};
const group: Shortcut = {
  id: 'g',
  label: 'Group',
  type: 'group',
  target: null,
  parentId: null,
  position: 1,
};
const inner: Shortcut = { ...top, id: 'i', parentId: 'g', position: 0 };

describe('shortcutTree', () => {
  it('lists the top level and puts children under their group', () => {
    expect(shortcutTree([top, group, inner])).toEqual([
      { shortcut: top, children: [] },
      { shortcut: group, children: [inner] },
    ]);
  });

  it('shows an empty group with no children', () => {
    expect(shortcutTree([group])).toEqual([{ shortcut: group, children: [] }]);
  });
});

describe('shortcutDetail', () => {
  it('shows the site of a link without www', () => {
    expect(
      shortcutDetail({ ...top, target: 'https://www.example.com/a?b=1' }),
    ).toBe('example.com');
  });

  it('shows the file name of an app', () => {
    expect(
      shortcutDetail({
        ...top,
        type: 'app',
        target: 'C:\\Program Files\\Code\\Code.exe',
      }),
    ).toBe('Code.exe');
  });

  it('says when there is no target', () => {
    expect(shortcutDetail({ ...top, target: null })).toBe('No link');
  });
});

describe('firstLetter', () => {
  it.each([
    ['mail', 'M'],
    ['  news', 'N'],
    ['😀 Fun', '😀'],
    ['éa', 'É'],
  ])('%s shows %s', (label, letter) => {
    expect(firstLetter(label)).toBe(letter);
  });
});
