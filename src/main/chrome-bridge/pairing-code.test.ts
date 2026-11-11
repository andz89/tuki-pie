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

// Stands in for Electron's safeStorage: reversible, and plainly not the code.
let available: boolean;
const vault = {
  isAvailable: () => available,
  encrypt: (text: string) => Buffer.from([...text].reverse().join('')),
  decrypt: (data: Buffer) => [...data.toString()].reverse().join(''),
};

beforeEach(() => {
  rows = {};
  available = true;
});

describe('the pairing code', () => {
  it('is made once and then kept', () => {
    const pairing = new PairingCode(repository, vault);
    const code = pairing.get();
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pairing.get()).toBe(code);
  });

  it('is stored encrypted, never as the code itself', () => {
    const code = new PairingCode(repository, vault).get();
    expect(rows[PAIRING_CODE_KEY]).toMatch(/^enc:/);
    expect(rows[PAIRING_CODE_KEY]).not.toContain(code);
    expect(new PairingCode(repository, vault).get()).toBe(code);
  });

  it('encrypts a code saved in plain text by an older version', () => {
    const old = 'a'.repeat(43);
    rows[PAIRING_CODE_KEY] = old;
    expect(new PairingCode(repository, vault).get()).toBe(old);
    expect(rows[PAIRING_CODE_KEY]).toMatch(/^enc:/);
  });

  it('keeps working in plain text where Windows offers no encryption', () => {
    available = false;
    const code = new PairingCode(repository, vault).get();
    expect(rows[PAIRING_CODE_KEY]).toBe(code);
    expect(new PairingCode(repository, vault).get()).toBe(code);
  });

  it('makes a new code when the stored one cannot be decrypted', () => {
    rows[PAIRING_CODE_KEY] = 'enc:!!!';
    const broken = {
      ...vault,
      decrypt: () => {
        throw new Error('other user');
      },
    };
    expect(new PairingCode(repository, broken).get()).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
  });

  it('changes with a new code', () => {
    const pairing = new PairingCode(repository, vault);
    const old = pairing.get();
    expect(pairing.renew()).not.toBe(old);
    expect(pairing.get()).not.toBe(old);
  });

  it('replaces a damaged stored code', () => {
    rows[PAIRING_CODE_KEY] = 'short';
    expect(new PairingCode(repository, vault).get()).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
  });

  it('never appears in the settings any window receives', () => {
    const code = new PairingCode(repository, vault).get();
    const settings = new SettingsService(repository).get();
    expect(JSON.stringify(settings)).not.toContain(code);
    expect(Object.keys(settings)).not.toContain(PAIRING_CODE_KEY);
  });
});
