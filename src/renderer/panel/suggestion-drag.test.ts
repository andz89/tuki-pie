import { describe, expect, it } from 'vitest';
import { dropMark, dropSpot, isSameSpot } from './suggestion-drag';
import type { SuggestionDrag } from './suggestion-drag';

const ROW = { top: 100, height: 20 };

describe('dropSpot', () => {
  it('drops before a row in its top half', () => {
    expect(dropSpot('g', 3, 105, ROW)).toEqual({ at: 'g', index: 3 });
  });

  it('drops after a row in its bottom half', () => {
    expect(dropSpot('g', 3, 115, ROW)).toEqual({ at: 'g', index: 4 });
  });
});

describe('isSameSpot', () => {
  it('compares group and index', () => {
    expect(isSameSpot({ at: 'g', index: 1 }, { at: 'g', index: 1 })).toBe(true);
    expect(isSameSpot({ at: 'g', index: 1 }, { at: 'h', index: 1 })).toBe(
      false,
    );
    expect(isSameSpot(null, { at: 'g', index: 1 })).toBe(false);
  });
});

describe('dropMark', () => {
  const drag: SuggestionDrag = {
    list: 'values',
    from: { at: 'g', index: 0 },
    over: { at: 'h', index: 2 },
  };

  it('fades the item being dragged', () => {
    expect(dropMark(drag, 'values', 'g', 0)).toBe('dragging');
  });

  it('marks a line above the row the drop lands before', () => {
    expect(dropMark(drag, 'values', 'h', 2)).toBe('before');
  });

  it('marks a line below the row the drop lands after', () => {
    expect(dropMark(drag, 'values', 'h', 1)).toBe('after');
  });

  it('marks nothing elsewhere, or for the other kind of drag', () => {
    expect(dropMark(drag, 'values', 'h', 0)).toBeNull();
    expect(dropMark(drag, 'groups', 'groups', 2)).toBeNull();
    expect(dropMark(null, 'values', 'h', 2)).toBeNull();
  });
});
