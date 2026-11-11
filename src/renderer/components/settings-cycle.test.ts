import { describe, expect, it } from 'vitest';
import {
  accentName,
  nextAccent,
  nextPin,
  nextSize,
  nextTheme,
} from './settings-cycle';

describe('nextPin', () => {
  it('flips between pinned and unpinned', () => {
    expect(nextPin('unpinned')).toBe('pinned');
    expect(nextPin('pinned')).toBe('unpinned');
  });
});

describe('nextTheme', () => {
  it('flips between dark and light', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });
});

describe('nextSize', () => {
  it('steps up through the sizes and wraps around', () => {
    expect(nextSize('small')).toBe('medium');
    expect(nextSize('medium')).toBe('large');
    expect(nextSize('large')).toBe('small');
  });
});

describe('nextAccent', () => {
  it('moves to the next preset color', () => {
    expect(nextAccent('#2563EB')).toBe('#0F766E');
  });

  it('wraps from the last preset to the first', () => {
    expect(nextAccent('#7C3AED')).toBe('#2563EB');
  });

  it('ignores upper or lower case', () => {
    expect(nextAccent('#2563eb')).toBe('#0F766E');
  });

  it('starts at the first preset from a custom color', () => {
    expect(nextAccent('#123456')).toBe('#2563EB');
  });
});

describe('accentName', () => {
  it('names a preset', () => {
    expect(accentName('#c2410c')).toBe('Orange');
  });

  it('calls anything else custom', () => {
    expect(accentName('#123456')).toBe('Custom');
  });
});
