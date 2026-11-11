import { describe, expect, it } from 'vitest';
import { activeTabAddress, chooseStartAddress } from './start-address';

const none = {
  activeTab: null,
  copied: null,
  lastCopied: null,
  shown: null,
};

describe('chooseStartAddress', () => {
  it('checks the active Chrome tab', () => {
    expect(
      chooseStartAddress({ ...none, activeTab: 'https://b.com/' }),
    ).toEqual({ address: 'https://b.com/', fromClipboard: false });
  });

  it('prefers the active Chrome tab over a copied address', () => {
    expect(
      chooseStartAddress({
        ...none,
        activeTab: 'https://b.com/',
        copied: 'https://a.com',
      }),
    ).toEqual({ address: 'https://b.com/', fromClipboard: false });
  });

  it('checks each new tab you click the slice on', () => {
    expect(
      chooseStartAddress({
        ...none,
        activeTab: 'https://c.com/',
        shown: 'https://b.com/',
      }),
    ).toEqual({ address: 'https://c.com/', fromClipboard: false });
  });

  it('does nothing when the window already shows the active tab', () => {
    expect(
      chooseStartAddress({
        ...none,
        activeTab: 'https://b.com/#reviews',
        shown: 'https://b.com/',
        copied: 'https://a.com',
      }),
    ).toBeNull();
  });

  it('falls back to a newly copied address', () => {
    expect(chooseStartAddress({ ...none, copied: 'https://a.com' })).toEqual({
      address: 'https://a.com',
      fromClipboard: true,
    });
  });

  it('does not check the same copied address twice', () => {
    expect(
      chooseStartAddress({
        ...none,
        copied: 'https://a.com',
        lastCopied: 'https://a.com',
      }),
    ).toBeNull();
  });

  it('does nothing with neither', () => {
    expect(chooseStartAddress(none)).toBeNull();
  });
});

describe('activeTabAddress', () => {
  it('accepts a web address', () => {
    expect(activeTabAddress({ url: 'https://a.com/' })).toBe('https://a.com/');
  });

  it.each([
    null,
    undefined,
    'https://a.com/',
    { url: 'javascript:alert(1)' },
    { url: 'chrome://settings/' },
    { url: 42 },
    { url: `https://a.com/${'x'.repeat(3000)}` },
  ])('refuses %j', (answer) => {
    expect(activeTabAddress(answer)).toBeNull();
  });
});
