import { describe, expect, it } from 'vitest';
import {
  NewShortcut,
  PanelFormRequest,
  isWebLink,
  normalizeWebAddress,
} from './shortcut.schema';

describe('isWebLink', () => {
  it.each(['https://a.com', 'http://a.com/x?y=1', 'https://localhost:3000'])(
    'accepts %s',
    (value) => {
      expect(isWebLink(value)).toBe(true);
    },
  );

  it.each([
    'file:///C:/a',
    'javascript:alert(1)',
    'https://',
    'ftp://a.com',
    'mailto:a@b.com',
    'a b',
    '',
  ])('refuses %s', (value) => {
    expect(isWebLink(value)).toBe(false);
  });
});

describe('normalizeWebAddress', () => {
  it('adds https to a bare address and trims it', () => {
    expect(normalizeWebAddress(' example.com ')).toBe('https://example.com');
  });

  it('does not mistake a port for a scheme', () => {
    expect(normalizeWebAddress('localhost:3000')).toBe(
      'https://localhost:3000',
    );
  });

  it('leaves a complete link alone', () => {
    expect(normalizeWebAddress('http://a.com')).toBe('http://a.com');
  });

  it('cannot turn a script link into a valid one', () => {
    expect(isWebLink(normalizeWebAddress('javascript:alert(1)'))).toBe(false);
  });
});

describe('NewShortcut', () => {
  it('accepts a link, an app and a group', () => {
    const items = [
      { label: 'L', type: 'link', target: 'https://a.com', parentId: null },
      { label: 'A', type: 'app', target: 'C:\\a.exe', parentId: 'g' },
      { label: 'G', type: 'group', target: null, parentId: null },
    ];
    expect(items.every((item) => NewShortcut.safeParse(item).success)).toBe(
      true,
    );
  });

  it('refuses a group inside a group', () => {
    expect(
      NewShortcut.safeParse({
        label: 'G',
        type: 'group',
        target: null,
        parentId: 'x',
      }).success,
    ).toBe(false);
  });

  it('refuses a link that is not http or https', () => {
    expect(
      NewShortcut.safeParse({
        label: 'L',
        type: 'link',
        target: 'file:///a',
        parentId: null,
      }).success,
    ).toBe(false);
  });

  it('refuses a name longer than 24 characters', () => {
    expect(
      NewShortcut.safeParse({
        label: 'x'.repeat(25),
        type: 'group',
        target: null,
        parentId: null,
      }).success,
    ).toBe(false);
  });
});

describe('PanelFormRequest', () => {
  it('refuses an unknown kind', () => {
    expect(PanelFormRequest.safeParse({ kind: 'nope' }).success).toBe(false);
  });

  it.each([
    { kind: 'snippet-new' },
    { kind: 'snippet-edit', id: 'abc' },
    { kind: 'snippets-section' },
  ])('accepts $kind', (request) => {
    expect(PanelFormRequest.safeParse(request).success).toBe(true);
  });

  it('refuses a snippet edit with no id', () => {
    expect(PanelFormRequest.safeParse({ kind: 'snippet-edit' }).success).toBe(
      false,
    );
  });
});
