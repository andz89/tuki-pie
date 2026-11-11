import { describe, expect, it } from 'vitest';
import { snippetPreview } from './snippet-row';

describe('snippetPreview', () => {
  it('turns line breaks into spaces', () => {
    expect(snippetPreview('one\r\n\ttwo')).toBe('one two');
  });

  it('leaves exactly 30 characters whole', () => {
    expect(snippetPreview('a'.repeat(30))).toBe('a'.repeat(30));
  });

  it('cuts longer text at 30 characters', () => {
    expect(snippetPreview('a'.repeat(31))).toBe(`${'a'.repeat(30)}…`);
  });

  it('keeps an emoji whole at the cut', () => {
    expect(snippetPreview(`${'a'.repeat(29)}😀b`)).toBe(`${'a'.repeat(29)}😀…`);
  });
});
