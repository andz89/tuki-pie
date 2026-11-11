// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { findRanges } from './highlight-search';

beforeEach(() => {
  document.body.innerHTML =
    '<p>Title: Lee Holden - flow! summit</p>' +
    '<p>FLOW and flow, overflow</p>' +
    '<button>Flow button</button>' +
    '<div class="no-highlight">flow ignored</div>';
});

const texts = (ranges: Range[]) => ranges.map((range) => range.toString());

describe('findRanges', () => {
  it('finds every match, ignoring case, in page order', () => {
    expect(texts(findRanges(document.body, 'flow'))).toEqual([
      'flow',
      'FLOW',
      'flow',
      'flow',
    ]);
  });

  it('skips buttons and no-highlight parts', () => {
    const ranges = findRanges(document.body, 'button');
    expect(ranges).toEqual([]);
    expect(texts(findRanges(document.body, 'ignored'))).toEqual([]);
  });

  it('finds nothing for an empty word', () => {
    expect(findRanges(document.body, '')).toEqual([]);
  });

  it('matches text with spaces in it', () => {
    expect(texts(findRanges(document.body, 'lee holden'))).toEqual([
      'Lee Holden',
    ]);
  });
});
