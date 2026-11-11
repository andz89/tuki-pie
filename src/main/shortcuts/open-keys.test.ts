import { globalShortcut } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserError } from '../services/user-error';
import { onOpenKeysPressed, resetOpenKeys, setOpenKeys } from './open-keys';

const taken = vi.hoisted(() => new Set<string>());
const held = vi.hoisted(() => new Map<string, () => void>());

vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn((keys: string, action: () => void) => {
      if (taken.has(keys) || held.has(keys)) return false;
      held.set(keys, action);
      return true;
    }),
    unregister: vi.fn((keys: string) => held.delete(keys)),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  taken.clear();
  held.clear();
  resetOpenKeys();
});

describe('setOpenKeys', () => {
  it('registers keys that run the open action', () => {
    const open = vi.fn();
    onOpenKeysPressed(open);
    setOpenKeys('Ctrl+Alt+Space');
    held.get('Ctrl+Alt+Space')?.();
    expect(open).toHaveBeenCalledOnce();
  });

  it('swaps old keys for new ones', () => {
    setOpenKeys('Ctrl+Alt+Space');
    setOpenKeys('Ctrl+Alt+P');
    expect([...held.keys()]).toEqual(['Ctrl+Alt+P']);
  });

  it('keeps the old keys when another app holds the new ones', () => {
    taken.add('Ctrl+Alt+P');
    setOpenKeys('Ctrl+Alt+Space');
    expect(() => setOpenKeys('Ctrl+Alt+P')).toThrow(UserError);
    expect([...held.keys()]).toEqual(['Ctrl+Alt+Space']);
  });

  it('turns the keys off', () => {
    setOpenKeys('Ctrl+Alt+Space');
    setOpenKeys('');
    expect(held.size).toBe(0);
  });

  it('refuses keys that are not allowed without touching the old ones', () => {
    setOpenKeys('Ctrl+Alt+Space');
    expect(() => setOpenKeys('Shift+A')).toThrow(UserError);
    expect([...held.keys()]).toEqual(['Ctrl+Alt+Space']);
  });

  it('does nothing when the keys are unchanged', () => {
    setOpenKeys('Ctrl+Alt+Space');
    setOpenKeys('Ctrl+Alt+Space');
    expect(globalShortcut.register).toHaveBeenCalledOnce();
  });
});
