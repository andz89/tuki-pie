import { describe, expect, it, vi } from 'vitest';
import { expandVariables, iconSteps, readAppIcon } from './app-icon';
import type { IconReader } from './app-icon';

const LINK = 'C:\\Users\\me\\Desktop\\Chat.lnk';

describe('iconSteps', () => {
  it('reads a shortcut: its .ico as a picture, then its program, then Explorer', () => {
    const readLink = () => ({
      icon: 'C:\\Apps\\chat.ico',
      target: 'C:\\Apps\\chat.exe',
    });
    expect(iconSteps(LINK, readLink)).toEqual([
      { kind: 'image', path: 'C:\\Apps\\chat.ico' },
      { kind: 'file', path: 'C:\\Apps\\chat.exe' },
      { kind: 'shell', path: LINK },
    ]);
  });

  it('never asks for the shortcut file icon, which is a blank page', () => {
    const steps = iconSteps(LINK, () => ({ target: 'C:\\a.exe' }));
    expect(steps).not.toContainEqual({ kind: 'file', path: LINK });
  });

  it('goes to Explorer for a Store app shortcut, which names nothing', () => {
    expect(iconSteps(LINK, () => ({ target: '', icon: '' }))).toEqual([
      { kind: 'shell', path: LINK },
    ]);
  });

  it('reads a program directly, with Explorer after it', () => {
    const readLink = vi.fn();
    expect(iconSteps('C:\\a.exe', readLink)).toEqual([
      { kind: 'file', path: 'C:\\a.exe' },
      { kind: 'shell', path: 'C:\\a.exe' },
    ]);
    expect(readLink).not.toHaveBeenCalled();
  });

  it('lists a path the shortcut gives twice only once', () => {
    const readLink = () => ({ icon: 'C:\\a.exe', target: 'C:\\a.exe' });
    expect(iconSteps(LINK, readLink)).toHaveLength(2);
  });

  it('still asks Explorer when the shortcut cannot be read', () => {
    const readLink = () => {
      throw new Error('broken');
    };
    expect(iconSteps(LINK, readLink)).toEqual([{ kind: 'shell', path: LINK }]);
  });
});

describe('expandVariables', () => {
  it('fills in variables, in any case', () => {
    expect(
      expandVariables('%SystemRoot%\\a.exe', { SYSTEMROOT: 'C:\\Windows' }),
    ).toBe('C:\\Windows\\a.exe');
  });

  it('leaves unknown ones as they are', () => {
    expect(expandVariables('%NOPE%\\a', {})).toBe('%NOPE%\\a');
  });
});

describe('readAppIcon', () => {
  const reader = (changes: Partial<IconReader>): IconReader => ({
    readLink: () => ({}),
    imageOf: async () => null,
    iconOf: async () => null,
    shellIconOf: async () => null,
    ...changes,
  });

  it('returns the first icon that reads', async () => {
    const iconOf = vi.fn().mockResolvedValue('data:image/png;base64,AA');
    const imageOf = vi.fn().mockRejectedValue(new Error('missing'));
    const shellIconOf = vi.fn();
    const icon = await readAppIcon(
      LINK,
      reader({
        readLink: () => ({ icon: 'C:\\gone.ico', target: 'C:\\a.exe' }),
        imageOf,
        iconOf,
        shellIconOf,
      }),
    );
    expect(icon).toBe('data:image/png;base64,AA');
    expect(iconOf).toHaveBeenCalledWith('C:\\a.exe');
    expect(shellIconOf).not.toHaveBeenCalled();
  });

  it('asks Explorer last', async () => {
    const icon = await readAppIcon(
      LINK,
      reader({ shellIconOf: async () => 'data:image/png;base64,BB' }),
    );
    expect(icon).toBe('data:image/png;base64,BB');
  });

  it('is null when nothing reads', async () => {
    expect(await readAppIcon('C:\\a.exe', reader({}))).toBeNull();
  });
});
