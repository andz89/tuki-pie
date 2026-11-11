import { describe, expect, it } from 'vitest';
import {
  addressFromClipboard,
  enteredAddress,
  isSiteUrl,
} from './site-address';

describe('isSiteUrl', () => {
  it.each(['https://a.com', 'http://a.com/x?y=1'])('allows %s', (url) => {
    expect(isSiteUrl(url)).toBe(true);
  });

  it.each([
    'file:///C:/a.txt',
    'javascript:alert(1)',
    'data:text/html,hi',
    'mailto:a@b.c',
    'chrome://gpu',
    '',
  ])('refuses %s', (url) => {
    expect(isSiteUrl(url)).toBe(false);
  });
});

describe('enteredAddress', () => {
  it('adds https to a bare address', () => {
    expect(enteredAddress(' example.com ')).toBe('https://example.com');
  });

  it('keeps a full address', () => {
    expect(enteredAddress('http://a.com/x')).toBe('http://a.com/x');
  });

  it('refuses another scheme', () => {
    expect(enteredAddress('file:///C:/a.txt')).toBeNull();
  });

  it('refuses a blank address', () => {
    expect(enteredAddress('   ')).toBeNull();
  });
});

describe('addressFromClipboard', () => {
  it('takes a copied address with spaces around it', () => {
    expect(addressFromClipboard('  https://a.com/x\r\n')).toBe(
      'https://a.com/x',
    );
  });

  it.each(['example.com', 'see https://a.com today', 'file:///C:/a.txt', ''])(
    'ignores %s on the clipboard',
    (text) => {
      expect(addressFromClipboard(text)).toBeNull();
    },
  );

  it('ignores two addresses on two lines', () => {
    expect(addressFromClipboard('https://a.com\nhttps://b.com')).toBeNull();
  });
});
