import { describe, expect, it } from 'vitest';
import { NewSnippet, SnippetEdit } from './snippet.schema';

const isValid = (label: string, content: string) =>
  NewSnippet.safeParse({ label, content }).success;

describe('NewSnippet', () => {
  it('accepts text of exactly 10000 characters', () => {
    expect(isValid('A', 'x'.repeat(10000))).toBe(true);
  });

  it('rejects text of 10001 characters', () => {
    expect(isValid('A', 'x'.repeat(10001))).toBe(false);
  });

  it('accepts a name of 24 characters', () => {
    expect(isValid('n'.repeat(24), 'x')).toBe(true);
  });

  it('rejects a name of 25 characters', () => {
    expect(isValid('n'.repeat(25), 'x')).toBe(false);
  });

  it('rejects a name of only spaces', () => {
    expect(isValid('   ', 'x')).toBe(false);
  });

  it('rejects text of only spaces and line breaks', () => {
    expect(isValid('A', ' \r\n\t ')).toBe(false);
  });
});

describe('SnippetEdit', () => {
  const isValidEdit = (label: string, content: string) =>
    SnippetEdit.safeParse({ id: 'a', label, content }).success;

  it('accepts a real change', () => {
    expect(isValidEdit('A', 'x')).toBe(true);
  });

  it('rejects a blank name', () => {
    expect(isValidEdit('   ', 'x')).toBe(false);
  });

  it('rejects blank text', () => {
    expect(isValidEdit('A', ' \n ')).toBe(false);
  });
});
