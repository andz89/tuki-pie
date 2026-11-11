import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, Settings } from './settings.schema';

describe('Settings schema', () => {
  it('accepts the default settings', () => {
    expect(Settings.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults to the dark theme and the blue accent', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('dark');
    expect(DEFAULT_SETTINGS.accent).toBe('#2563EB');
  });

  it('rejects an unknown theme', () => {
    expect(
      Settings.safeParse({ ...DEFAULT_SETTINGS, theme: 'blue' }).success,
    ).toBe(false);
  });

  it('rejects an accent that is not a six-digit hex color', () => {
    expect(
      Settings.safeParse({ ...DEFAULT_SETTINGS, accent: 'red' }).success,
    ).toBe(false);
  });
});
