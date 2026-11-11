import { describe, expect, it } from 'vitest';
import {
  PAGE_INFO_INDEX,
  SETTINGS_INDEX,
  SHORTCUTS_INDEX,
} from '../components/slice-display';
import { aimsAt, isDoublePress, pressOutcome } from './ring-press';

describe('isDoublePress', () => {
  const first = { index: 2, x: 100, y: 100, at: 1000 };

  it('is soon after, close by, on the same slice', () => {
    expect(isDoublePress(first, { ...first, at: 1200 })).toBe(true);
  });

  it('is not too late, too far, or on another slice', () => {
    expect(isDoublePress(first, { ...first, at: 1500 })).toBe(false);
    expect(isDoublePress(first, { ...first, x: 120, at: 1100 })).toBe(false);
    expect(isDoublePress(first, { ...first, index: 3, at: 1100 })).toBe(false);
    expect(isDoublePress(null, first)).toBe(false);
  });
});

describe('pressOutcome', () => {
  it('locks a slice with circles or a list on a double-click', () => {
    expect(pressOutcome(null, SHORTCUTS_INDEX, true)).toBe('lock');
    expect(pressOutcome(SHORTCUTS_INDEX, SETTINGS_INDEX, true)).toBe('lock');
  });

  it('unlocks on a double-click on the locked slice, or one with nothing', () => {
    expect(pressOutcome(SHORTCUTS_INDEX, SHORTCUTS_INDEX, true)).toBe('unlock');
    expect(pressOutcome(SHORTCUTS_INDEX, PAGE_INFO_INDEX, true)).toBe('unlock');
  });

  it('ignores a click on another slice while locked', () => {
    expect(pressOutcome(SHORTCUTS_INDEX, PAGE_INFO_INDEX, false)).toBe(
      'ignore',
    );
  });

  it('waits on a lockable slice, and runs the others at once', () => {
    expect(pressOutcome(null, SHORTCUTS_INDEX, false)).toBe('wait');
    expect(pressOutcome(null, PAGE_INFO_INDEX, false)).toBe('run');
  });
});

describe('aimsAt', () => {
  const hole = { center: { x: 0, y: 0 }, radius: 70 };
  const box = { left: 250, top: -50, right: 450, bottom: 150 };

  it('is true when the mouse heads for the box', () => {
    expect(aimsAt({ x: 100, y: 100 }, { x: 110, y: 98 }, box, hole)).toBe(true);
  });

  it('is false when it heads away', () => {
    expect(aimsAt({ x: 110, y: 100 }, { x: 100, y: 100 }, box, hole)).toBe(
      false,
    );
  });

  it('is false when the way there crosses the hole', () => {
    expect(aimsAt({ x: -200, y: 0 }, { x: -190, y: 0 }, box, hole)).toBe(false);
  });
});
