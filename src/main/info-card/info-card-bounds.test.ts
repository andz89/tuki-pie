import { describe, expect, it } from 'vitest';
import {
  BAR_HEIGHT,
  LIST_WIDTH,
  SIDEBAR_WIDTH,
  infoCardBounds,
  listCardBounds,
} from './info-card-bounds';

const work = { x: 100, y: 0, width: 1920, height: 1040 };

describe('Info Card place', () => {
  it('runs down the right edge as a sidebar', () => {
    expect(infoCardBounds('sidebar', work)).toEqual({
      x: 100 + 1920 - SIDEBAR_WIDTH,
      y: 0,
      width: SIDEBAR_WIDTH,
      height: 1040,
    });
  });

  it('runs across the top or the bottom as a bar', () => {
    expect(infoCardBounds('top', work)).toEqual({
      x: 100,
      y: 0,
      width: 1920,
      height: BAR_HEIGHT,
    });
    expect(infoCardBounds('bottom', work).y).toBe(1040 - BAR_HEIGHT);
  });

  it('puts the Links and Images cards down the right edge, wider', () => {
    expect(listCardBounds(work)).toEqual({
      x: 100 + 1920 - LIST_WIDTH,
      y: 0,
      width: LIST_WIDTH,
      height: 1040,
    });
  });

  it('never grows past a small screen', () => {
    const small = { x: 0, y: 0, width: 300, height: 100 };
    expect(infoCardBounds('sidebar', small).width).toBe(300);
    expect(infoCardBounds('top', small).height).toBe(100);
  });
});
