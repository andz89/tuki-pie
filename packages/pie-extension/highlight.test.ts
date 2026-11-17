// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { highlightWordsOnPage } from './highlight.js';

const MARK_JS = readFileSync(
  path.join(__dirname, 'vendor', 'mark.min.js'),
  'utf8',
);

type WithMark = typeof globalThis & { Mark?: unknown };

beforeAll(() => {
  // As Chrome runs vendor/mark.min.js: a plain script that sets Mark. Only
  // our own vendored file, in a test.
  // eslint-disable-next-line no-eval
  (0, eval)(MARK_JS);
  (window as unknown as WithMark).Mark = (globalThis as WithMark).Mark;
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  document.body.innerHTML =
    '<p>Our price list. The <b>price</b> is fair.</p><script>var price;</script>';
});

const marked = () =>
  [...document.querySelectorAll('mark.pie-highlight')].map(
    (each) => each.textContent,
  );

describe('highlighting words on the page', () => {
  it('marks every place a word appears, ignoring case and scripts', async () => {
    await expect(highlightWordsOnPage(['PRICE'])).resolves.toBe(2);
    expect(marked()).toEqual(['price', 'price']);
  });

  it('replaces the last marks, and clears them with no words', async () => {
    await highlightWordsOnPage(['price']);
    await expect(highlightWordsOnPage(['fair'])).resolves.toBe(1);
    expect(marked()).toEqual(['fair']);
    await expect(highlightWordsOnPage([])).resolves.toBe(0);
    expect(marked()).toEqual([]);
    expect(document.body.textContent).toContain('Our price list.');
  });
});
