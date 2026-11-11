import { beforeEach, describe, expect, it } from 'vitest';
import type { SettingsRepository } from '../repositories/settings.repository';
import { SettingsService } from '../services/settings.service';
import { PAIRING_CODE_KEY, PairingCode } from './pairing-code';

let rows: Record<string, string>;
const repository = {
  getAll: () => ({ ...rows }),
  set: (key: string, value: string) => {
    rows[key] = value;
  },
} as unknown as SettingsRepository;

beforeEach(() => {
  rows = {};
});

describe('the pairing code', () => {
  it('is made once and then kept', () => {
    const pairing = new PairingCode(repository);
    const code = pairing.get();
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pairing.get()).toBe(code);
    expect(rows[PAIRING_CODE_KEY]).toBe(code);
  });

  it('changes with a new code', () => {
    const pairing = new PairingCode(repository);
    const old = pairing.get();
    expect(pairing.renew()).not.toBe(old);
    expect(pairing.get()).not.toBe(old);
  });

  it('replaces a damaged stored code', () => {
    rows[PAIRING_CODE_KEY] = 'short';
    expect(new PairingCode(repository).get()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('never appears in the settings any window receives', () => {
    const code = new PairingCode(repository).get();
    const settings = new SettingsService(repository).get();
    expect(JSON.stringify(settings)).not.toContain(code);
    expect(Object.keys(settings)).not.toContain(PAIRING_CODE_KEY);
  });
});
