import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../shared/types';
import { migrate } from '../db/migrate';
import { SettingsRepository } from '../repositories/settings.repository';
import { SettingsService } from './settings.service';
import { UserError } from './user-error';

let effects: {
  useOpenKeys: ReturnType<typeof vi.fn<(keys: string) => void>>;
  applied: ReturnType<typeof vi.fn<(saved: Settings) => void>>;
};
let settings: SettingsService;

beforeEach(() => {
  const db = new Database(':memory:');
  migrate(db);
  effects = { useOpenKeys: vi.fn(), applied: vi.fn() };
  settings = new SettingsService(new SettingsRepository(db), effects);
});

describe('changing settings', () => {
  it('saves a change and returns the new settings', () => {
    expect(settings.change({ theme: 'light' }).theme).toBe('light');
    expect(settings.get().theme).toBe('light');
  });

  it('hands every saved change to the app, to resize, pin and tell Chrome', () => {
    const saved = settings.change({ size: 'large', pin: 'pinned' });
    expect(effects.applied).toHaveBeenCalledExactlyOnceWith(saved);
  });

  it('registers new open keys before saving them', () => {
    settings.change({ openKeys: 'Ctrl+Alt+P' });
    expect(effects.useOpenKeys).toHaveBeenCalledExactlyOnceWith('Ctrl+Alt+P');
    expect(settings.get().openKeys).toBe('Ctrl+Alt+P');
  });

  it('does not save open keys that are refused', () => {
    effects.useOpenKeys.mockImplementationOnce(() => {
      throw new UserError('Those keys are already used by another app.');
    });
    expect(() => settings.change({ openKeys: 'Ctrl+Alt+P' })).toThrow(
      'already used',
    );
    expect(settings.get().openKeys).toBe('Ctrl+Alt+Space');
    expect(effects.applied).not.toHaveBeenCalled();
  });

  it('leaves the open keys alone when they are not changed', () => {
    settings.change({ theme: 'light' });
    expect(effects.useOpenKeys).not.toHaveBeenCalled();
  });
});
