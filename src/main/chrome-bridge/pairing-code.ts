import { randomBytes } from 'node:crypto';
import type { SettingsRepository } from '../repositories/settings.repository';

// Stored beside the settings, but the settings schema drops unknown keys, so
// the code never reaches any window through `Settings`.
export const PAIRING_CODE_KEY = 'chromePairingCode';
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ENCRYPTED = 'enc:';

// Electron's safeStorage, or a stand-in in tests. On Windows it encrypts
// for the signed-in user, so the database file alone doesn't give the code.
export interface Vault {
  isAvailable(): boolean;
  encrypt(text: string): Buffer;
  decrypt(data: Buffer): string;
}

export class PairingCode {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly vault: Vault,
  ) {}

  get(): string {
    const saved = this.settings.getAll()[PAIRING_CODE_KEY];
    const code = saved === undefined ? null : this.read(saved);
    if (code === null) {
      return this.renew();
    }
    // Saved in plain text by an older version, or before encryption worked.
    if (!saved?.startsWith(ENCRYPTED) && this.vault.isAvailable()) {
      this.store(code);
    }
    return code;
  }

  // 32 random bytes, meant to be copied rather than typed.
  renew(): string {
    const code = randomBytes(32).toString('base64url');
    this.store(code);
    return code;
  }

  private read(saved: string): string | null {
    let code = saved;
    if (saved.startsWith(ENCRYPTED)) {
      try {
        code = this.vault.decrypt(
          Buffer.from(saved.slice(ENCRYPTED.length), 'base64'),
        );
      } catch {
        // Encrypted for another Windows user, or damaged.
        return null;
      }
    }
    return CODE_PATTERN.test(code) ? code : null;
  }

  // Plain text only where Windows offers no encryption, so pairing still works.
  private store(code: string): void {
    const value = this.vault.isAvailable()
      ? ENCRYPTED + this.vault.encrypt(code).toString('base64')
      : code;
    this.settings.set(PAIRING_CODE_KEY, value);
  }
}
