import { describe, expect, it } from 'vitest';
import { cssName, sectionSelector } from './section-selector';

describe('sectionSelector', () => {
  it('is empty for the whole page, whatever the kind', () => {
    for (const kind of ['class', 'id', 'mixed'] as const) {
      expect(sectionSelector(kind, '   ')).toEqual({ selector: '' });
    }
  });

  it('reads class names as one element with all of them', () => {
    expect(
      sectionSelector(
        'class',
        ' et_pb_section_0_tb_body et_pb_section  et_section_regular ',
      ),
    ).toEqual({
      selector: '.et_pb_section_0_tb_body.et_pb_section.et_section_regular',
    });
  });

  it('ignores periods typed in front of class names anyway', () => {
    expect(sectionSelector('class', '.a b ..c')).toEqual({
      selector: '.a.b.c',
    });
  });

  it('reads one id, with or without #', () => {
    expect(sectionSelector('id', 'hero')).toEqual({ selector: '#hero' });
    expect(sectionSelector('id', '#hero')).toEqual({ selector: '#hero' });
  });

  it('says an id has no spaces', () => {
    expect(sectionSelector('id', 'a b')).toEqual({
      error: expect.stringContaining('An id has no spaces'),
    });
  });

  it('takes mixed as CSS, as typed', () => {
    expect(sectionSelector('mixed', ' .pricing #hero > a ')).toEqual({
      selector: '.pricing #hero > a',
    });
  });

  it('escapes names CSS would read otherwise', () => {
    expect(sectionSelector('class', '2col md:flex')).toEqual({
      selector: '.\\32 col.md\\:flex',
    });
  });

  it('says when the selector would be too long', () => {
    expect(sectionSelector('class', ':'.repeat(300))).toEqual({
      error: 'The section is too long.',
    });
  });
});

describe('cssName', () => {
  it('keeps plain names as they are', () => {
    expect(cssName('et_pb-section_0')).toBe('et_pb-section_0');
  });

  it('escapes a leading digit and a lone hyphen', () => {
    expect(cssName('1a')).toBe('\\31 a');
    expect(cssName('-1')).toBe('-\\31 ');
    expect(cssName('-')).toBe('\\-');
  });
});
