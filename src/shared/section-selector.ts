import { MAX_SECTION_SELECTOR } from './types';

// How the Section field of the Screenshot tab is read.
// class: class names of one element, without periods.
// id: one id, without #.
// mixed: a CSS selector, with a period before each class and # before each id.
export const SECTION_KINDS = ['class', 'id', 'mixed'] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  class: 'Class name',
  id: 'ID',
  mixed: 'Mixed',
};

const ID_HAS_SPACES =
  'An id has no spaces. Choose Class name or Mixed for more than one name.';
const TOO_LONG = 'The section is too long.';

// A name as CSS writes it, so "2col" or "a:b" still match as typed.
// As CSS.escape does it, which not every place this runs has.
export function cssName(name: string): string {
  let out = '';
  for (let i = 0; i < name.length; i++) {
    const char = name[i];
    const code = name.charCodeAt(i);
    if (code === 0) {
      out += '�';
    } else if (
      (code >= 0x1 && code <= 0x1f) ||
      code === 0x7f ||
      (i === 0 && code >= 0x30 && code <= 0x39) ||
      (i === 1 && code >= 0x30 && code <= 0x39 && name[0] === '-')
    ) {
      out += `\\${code.toString(16)} `;
    } else if (i === 0 && char === '-' && name.length === 1) {
      out += '\\-';
    } else if (code >= 0x80 || /[\w-]/.test(char)) {
      out += char;
    } else {
      out += `\\${char}`;
    }
  }
  return out;
}

// The CSS selector for what was typed, "" for the whole page, or a problem
// to show.
export function sectionSelector(
  kind: SectionKind,
  text: string,
): { selector: string } | { error: string } {
  const typed = text.trim();
  let selector = typed;
  if (typed && kind === 'class') {
    selector = typed
      .split(/\s+/)
      .map((name) => name.replace(/^\.+/, ''))
      .filter(Boolean)
      .map((name) => `.${cssName(name)}`)
      .join('');
  } else if (typed && kind === 'id') {
    const id = typed.replace(/^#+/, '');
    if (/\s/.test(id)) {
      return { error: ID_HAS_SPACES };
    }
    selector = id ? `#${cssName(id)}` : '';
  }
  if (selector.length > MAX_SECTION_SELECTOR) {
    return { error: TOO_LONG };
  }
  return { selector };
}
