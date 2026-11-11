import { describe, expect, it } from 'vitest';
import { areaBetween, isBigEnough } from './selection';

describe('areaBetween', () => {
  it('measures a drag down and to the right', () => {
    expect(areaBetween({ x: 10, y: 20 }, { x: 110, y: 70 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it('measures a drag up and to the left the same way', () => {
    expect(areaBetween({ x: 110, y: 70 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });
});

describe('isBigEnough', () => {
  it('accepts a real section', () => {
    expect(isBigEnough({ x: 0, y: 0, width: 40, height: 30 })).toBe(true);
  });

  it('treats a click without a drag as nothing', () => {
    expect(isBigEnough({ x: 5, y: 5, width: 1, height: 0 })).toBe(false);
  });
});
