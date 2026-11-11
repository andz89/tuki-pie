import { describe, expect, it } from 'vitest';
import COLLECT_PAGE from './collect-page.js?raw';
import SHOW_LINK from './show-link.js?raw';

// show-link.js finds a link by its place in Page Info's list, so it must pick
// links by exactly the rules collect-page.js used. Both run inside the page
// on their own, so they can't share code; this keeps the copies equal.

// The text of `const name = ...;`, through its closing brace or semicolon,
// with spacing and comments taken out.
function definition(source: string, name: string): string {
  const start = source.indexOf(`const ${name} =`);
  if (start === -1) {
    throw new Error(`${name} not found`);
  }
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (char === '{' || char === '(' || char === '[') {
      depth += 1;
    } else if (char === '}' || char === ')' || char === ']') {
      depth -= 1;
    } else if (char === ';' && depth === 0) {
      return source
        .slice(start, i)
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  throw new Error(`${name} has no end`);
}

describe('show-link.js and collect-page.js', () => {
  it.each([
    'MAX_URL',
    'LINK_PROTOCOLS',
    'isText',
    'isUsableUrl',
    'isListedLink',
    'hasBox',
    'isShown',
  ])('define %s the same way', (name) => {
    expect(definition(SHOW_LINK, name)).toBe(definition(COLLECT_PAGE, name));
  });

  it('both pick links from every a[href] on the page', () => {
    expect(SHOW_LINK).toContain(
      "document.querySelectorAll('a[href]')].filter(isListedLink)",
    );
    expect(COLLECT_PAGE).toContain("all('a[href]').filter(isListedLink)");
  });
});
