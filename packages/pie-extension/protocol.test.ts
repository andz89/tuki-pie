import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_EVENTS } from '../../src/main/chrome-bridge/chrome-bridge';
import { isNonce, randomNonce, sameText, sign } from './crypto.js';
import {
  EVENTS,
  appProofText,
  extProofText,
  isWebAddress,
  sameAddress,
} from './protocol.js';

const root = path.resolve(__dirname, '../..');

describe('the page reader copy', () => {
  it('matches the app reader exactly', () => {
    const app = readFileSync(
      path.join(root, 'src/main/page-info/collect-page.js'),
      'utf8',
    );
    const extension = readFileSync(
      path.join(root, 'packages/pie-extension/collect-page.js'),
      'utf8',
    );
    expect(extension).toBe(app);
  });
});

describe('the manifest', () => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(root, 'packages/pie-extension/manifest.json'),
      'utf8',
    ),
  );

  it('asks only for the permissions it needs', () => {
    expect(manifest.permissions.sort()).toEqual([
      'alarms',
      'debugger',
      'scripting',
      'storage',
      'webNavigation',
    ]);
  });

  it('holds only a public key', () => {
    expect(manifest.key).toMatch(/^MIIB/);
    expect(JSON.stringify(manifest)).not.toMatch(/PRIVATE/);
  });
});

describe('events', () => {
  it('are the same list on both sides', () => {
    expect(EVENTS).toEqual([...SITE_EVENTS]);
  });
});

describe('isWebAddress', () => {
  it.each(['https://a.com/', 'http://a.com/x?y=1'])('accepts %s', (url) => {
    expect(isWebAddress(url)).toBe(true);
  });

  it.each([
    'file:///c:/x',
    'chrome://settings',
    'javascript:alert(1)',
    'about:blank',
    'not a url',
    42,
    undefined,
  ])('refuses %s', (url) => {
    expect(isWebAddress(url)).toBe(false);
  });
});

describe('sameAddress', () => {
  it('ignores anything after #', () => {
    expect(sameAddress('https://a.com/p#reviews', 'https://a.com/p')).toBe(
      true,
    );
  });

  it('treats a missing slash as the same page', () => {
    expect(sameAddress('https://a.com', 'https://a.com/')).toBe(true);
  });

  it('keeps www. apart', () => {
    expect(sameAddress('https://a.com/', 'https://www.a.com/')).toBe(false);
  });

  it('keeps different queries apart', () => {
    expect(sameAddress('https://a.com/?x=1', 'https://a.com/?x=2')).toBe(false);
  });

  it('never matches a non-web address', () => {
    expect(sameAddress('chrome://newtab/', 'chrome://newtab/')).toBe(false);
  });
});

describe('proof text', () => {
  it('differs between the two sides for the same nonces', () => {
    expect(appProofText('a', 'b')).not.toBe(extProofText('b', 'a'));
    expect(appProofText('a', 'b')).not.toBe(extProofText('a', 'b'));
  });
});

describe('crypto', () => {
  it('makes 32-byte hex nonces that differ', () => {
    const first = randomNonce();
    expect(isNonce(first)).toBe(true);
    expect(randomNonce()).not.toBe(first);
  });

  it('signs the same text the same way with the same code', async () => {
    expect(await sign('code', 'text')).toBe(await sign('code', 'text'));
    expect(await sign('code', 'text')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs differently with another code', async () => {
    expect(await sign('code', 'text')).not.toBe(await sign('other', 'text'));
  });

  it('compares text exactly', () => {
    expect(sameText('abc', 'abc')).toBe(true);
    expect(sameText('abc', 'abd')).toBe(false);
    expect(sameText('abc', 'ab')).toBe(false);
    expect(sameText(undefined, 'abc')).toBe(false);
  });
});
