import { describe, expect, it } from 'vitest';
import { cleanPastedPath, isLocalPath } from './clean-pasted-path';

describe('cleanPastedPath', () => {
  it('leaves a plain path alone', () => {
    expect(cleanPastedPath('C:\\Users\\Me\\Work')).toBe('C:\\Users\\Me\\Work');
  });

  it('removes the quotes from "Copy as path"', () => {
    expect(cleanPastedPath('"C:\\Notes\\a b.txt"')).toBe('C:\\Notes\\a b.txt');
  });

  it('removes spaces around the path', () => {
    expect(cleanPastedPath('  C:\\Work  ')).toBe('C:\\Work');
  });

  it('removes spaces outside and inside the quotes', () => {
    expect(cleanPastedPath(' " C:\\Work " ')).toBe('C:\\Work');
  });

  it('keeps spaces inside a path', () => {
    expect(cleanPastedPath('C:\\Program Files\\a')).toBe(
      'C:\\Program Files\\a',
    );
  });

  it('keeps an apostrophe in a name', () => {
    expect(cleanPastedPath("C:\\Me's notes")).toBe("C:\\Me's notes");
  });

  it('turns bare quotes into nothing', () => {
    expect(cleanPastedPath('""')).toBe('');
  });
});

describe('isLocalPath', () => {
  it.each(['C:\\Users\\me', 'd:/work', '\\\\server\\share'])(
    '%s is a path',
    (value) => {
      expect(isLocalPath(value)).toBe(true);
    },
  );

  it.each(['example.com', 'https://a.com', 'localhost:3000', 'C:'])(
    '%s is not a path',
    (value) => {
      expect(isLocalPath(value)).toBe(false);
    },
  );
});
