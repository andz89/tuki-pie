import { describe, expect, it } from 'vitest';
import type { Shortcut } from '../../shared/types';
import { TOP_ROW_END, dropSpot } from './shortcut-drop';

const item = (
  id: string,
  type: Shortcut['type'],
  parentId: string | null,
  position: number,
): Shortcut => ({
  id,
  label: id,
  type,
  target: type === 'group' ? null : 'https://a.com',
  parentId,
  position,
});

// Top row: a, g, b, h. Inside g: x, y.
const SHORTCUTS: Shortcut[] = [
  item('a', 'link', null, 0),
  item('g', 'group', null, 1),
  item('x', 'link', 'g', 0),
  item('y', 'app', 'g', 1),
  item('b', 'link', null, 2),
  item('h', 'group', null, 3),
];

const spot = (dragged: string, over: string) =>
  dropSpot(SHORTCUTS, dragged, over);

describe('dropSpot', () => {
  it('puts a link dropped on a group at the end of that group', () => {
    expect(spot('a', 'g')).toEqual({
      parentId: 'g',
      index: 2,
      markId: 'g',
      mark: 'inside',
    });
  });

  it('puts a link dropped on a shortcut in a group at that place', () => {
    expect(spot('b', 'y')).toMatchObject({ parentId: 'g', index: 1 });
    expect(spot('b', 'y')?.mark).toBe('before');
  });

  it('takes a link out of a group when dropped on a top row link', () => {
    expect(spot('x', 'b')).toMatchObject({
      parentId: null,
      index: 2,
      mark: 'before',
    });
  });

  it('moves a link down its own row to just after the one dropped on', () => {
    expect(spot('a', 'b')).toMatchObject({
      parentId: null,
      index: 2,
      mark: 'after',
    });
  });

  it('moves a link up its own row to just before the one dropped on', () => {
    expect(spot('y', 'x')).toMatchObject({
      parentId: 'g',
      index: 0,
      mark: 'before',
    });
  });

  it('moves a group along the top row, never inside another', () => {
    expect(spot('g', 'h')).toMatchObject({
      parentId: null,
      index: 3,
      mark: 'after',
    });
  });

  it('treats a group dropped on a shortcut in a group as beside that group', () => {
    expect(spot('h', 'x')).toMatchObject({ parentId: null, index: 1 });
  });

  it('ignores a group dropped on its own shortcuts', () => {
    expect(spot('g', 'x')).toBeNull();
  });

  it('puts a shortcut dropped below the list at the end of the top row', () => {
    expect(spot('x', TOP_ROW_END)).toEqual({
      parentId: null,
      index: 4,
      markId: TOP_ROW_END,
      mark: 'inside',
    });
  });

  it('ignores a drop that changes nothing', () => {
    expect(spot('a', 'a')).toBeNull();
    expect(spot('y', 'g')).toBeNull();
  });

  it('ignores a row that is not there', () => {
    expect(spot('a', 'gone')).toBeNull();
    expect(spot('gone', 'a')).toBeNull();
  });
});
