import { describe, expect, it } from 'vitest';
import { checkKeys, formatKeys, keysFromPress } from './open-keys';

const NONE = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };

describe('keysFromPress', () => {
  it('builds keys from a press with modifiers', () => {
    expect(
      keysFromPress({ ...NONE, code: 'Space', ctrlKey: true, altKey: true }),
    ).toEqual({ ok: true, keys: 'Ctrl+Alt+Space' });
  });

  it('uses the physical key, not the typed character', () => {
    expect(keysFromPress({ ...NONE, code: 'KeyQ', metaKey: true })).toEqual({
      ok: true,
      keys: 'Super+Q',
    });
  });

  it('waits while only modifiers are held', () => {
    expect(
      keysFromPress({ ...NONE, code: 'ControlLeft', ctrlKey: true }),
    ).toBeNull();
    expect(
      keysFromPress({ ...NONE, code: 'MetaLeft', metaKey: true }),
    ).toBeNull();
  });

  it('refuses a plain key or Shift plus a letter', () => {
    expect(keysFromPress({ ...NONE, code: 'KeyA' })?.ok).toBe(false);
    expect(keysFromPress({ ...NONE, code: 'KeyA', shiftKey: true })?.ok).toBe(
      false,
    );
  });

  it('allows a function key alone', () => {
    expect(keysFromPress({ ...NONE, code: 'F9' })).toEqual({
      ok: true,
      keys: 'F9',
    });
  });

  it('refuses F24, which the app uses itself', () => {
    expect(keysFromPress({ ...NONE, code: 'F24', ctrlKey: true })?.ok).toBe(
      false,
    );
  });

  it('refuses keys it does not know', () => {
    expect(
      keysFromPress({ ...NONE, code: 'MediaPlayPause', ctrlKey: true })?.ok,
    ).toBe(false);
  });
});

describe('checkKeys', () => {
  it('accepts off and good keys', () => {
    expect(checkKeys('').ok).toBe(true);
    expect(checkKeys('Ctrl+Alt+Space').ok).toBe(true);
    expect(checkKeys('Ctrl+Shift+num5').ok).toBe(true);
    expect(checkKeys('Alt+\\').ok).toBe(true);
  });

  it('refuses unknown, repeated or out-of-order modifiers', () => {
    expect(checkKeys('Hyper+A').ok).toBe(false);
    expect(checkKeys('Ctrl+Ctrl+A').ok).toBe(false);
    expect(checkKeys('Alt+Ctrl+A').ok).toBe(false);
  });

  it('refuses unknown keys and missing modifiers', () => {
    expect(checkKeys('Ctrl+Banana').ok).toBe(false);
    expect(checkKeys('Shift+A').ok).toBe(false);
  });
});

describe('formatKeys', () => {
  it('spaces the keys and calls Super Win', () => {
    expect(formatKeys('Ctrl+Super+Space')).toBe('Ctrl + Win + Space');
  });

  it('shows Off for no keys', () => {
    expect(formatKeys('')).toBe('Off');
  });
});
