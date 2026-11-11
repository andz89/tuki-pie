import { describe, expect, it } from 'vitest';
import { pieWindowBounds } from './pie-position';

// The donut plus the room the Settings circle needs when it pops out.
const VISIBLE_SIZE = 428;
const VISIBLE_INSET = 26;

const mainScreen = { x: 0, y: 0, width: 1920, height: 1040 };
const leftScreen = { x: -1920, y: 0, width: 1280, height: 760 };

function position(cursor: { x: number; y: number }, workArea = mainScreen) {
  const { x, y } = pieWindowBounds(cursor, workArea);
  return [x, y];
}

describe('pieWindowBounds', () => {
  it('centers the donut on the mouse', () => {
    expect(pieWindowBounds({ x: 960, y: 520 }, mainScreen)).toEqual({
      x: 720,
      y: 280,
      width: 480,
      height: 480,
    });
  });

  it('makes the window larger for a larger donut', () => {
    expect(pieWindowBounds({ x: 960, y: 520 }, mainScreen, 1.25)).toEqual({
      x: 660,
      y: 220,
      width: 600,
      height: 600,
    });
  });

  it('keeps a larger donut on screen at the top left', () => {
    const { x, y } = pieWindowBounds({ x: 0, y: 0 }, mainScreen, 1.25);
    expect([x, y]).toEqual([-32, -32]);
  });

  it('keeps a larger donut on screen at the bottom right', () => {
    const { x, y } = pieWindowBounds({ x: 1919, y: 1039 }, mainScreen, 1.25);
    expect([x, y]).toEqual([1353, 473]);
  });

  it('keeps the donut on screen at the left edge', () => {
    expect(position({ x: 0, y: 520 })).toEqual([-26, 280]);
  });

  it('keeps the donut on screen at the right edge', () => {
    expect(position({ x: 1919, y: 520 })).toEqual([1466, 280]);
  });

  it('keeps the donut on screen at the top edge', () => {
    expect(position({ x: 960, y: 0 })).toEqual([720, -26]);
  });

  it('keeps the donut on screen at the bottom edge', () => {
    expect(position({ x: 960, y: 1039 })).toEqual([720, 586]);
  });

  it('works on a monitor to the left of the main one', () => {
    expect(position({ x: -1280, y: 380 }, leftScreen)).toEqual([-1520, 140]);
  });

  it('stays on that monitor at its right edge', () => {
    expect(position({ x: -641, y: 759 }, leftScreen)).toEqual([-1094, 306]);
  });

  it.each([
    [mainScreen, { x: 3, y: 1036 }],
    [mainScreen, { x: 1917, y: 2 }],
    [leftScreen, { x: -1919, y: 1 }],
    [leftScreen, { x: -645, y: 755 }],
  ])('never lets the donut leave %o at %o', (workArea, cursor) => {
    const [x, y] = position(cursor, workArea);
    expect(x + VISIBLE_INSET).toBeGreaterThanOrEqual(workArea.x);
    expect(y + VISIBLE_INSET).toBeGreaterThanOrEqual(workArea.y);
    expect(x + VISIBLE_INSET + VISIBLE_SIZE).toBeLessThanOrEqual(
      workArea.x + workArea.width,
    );
    expect(y + VISIBLE_INSET + VISIBLE_SIZE).toBeLessThanOrEqual(
      workArea.y + workArea.height,
    );
  });
});
