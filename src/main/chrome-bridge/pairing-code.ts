import { randomBytes } from 'node:crypto';
import type { SettingsRepository } from '../repositories/settings.repository';

// Stored beside the settings, but the settings schema drops unknown keys, so
// the code never reaches any window through `Settings`.
export const PAIRING_CODE_KEY = 'chromePairingCode';
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class PairingCode {
  constructor(private readonly settings: SettingsRepository) {}

  get(): string {
    const saved = this.settings.getAll()[PAIRING_CODE_KEY];
    return saved !== undefined && CODE_PATTERN.test(saved)
      ? saved
      : this.renew();
  }

  // 32 random bytes, meant to be copied rather than typed.
  renew(): string {
    const code = randomBytes(32).toString('base64url');
    this.settings.set(PAIRING_CODE_KEY, code);
    return code;
  }
}
