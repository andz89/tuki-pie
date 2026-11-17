import { describe, expect, it, vi } from 'vitest';
import { MAX_RESULTS, createHistorySearch } from './history.js';

const NOW = 1_000_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function fakeChrome(
  items: { url?: string; title?: string; lastVisitTime?: number }[],
) {
  const search = vi.fn(async () => items);
  return { chrome: { history: { search } }, search };
}

// The pages found, after checking the answer names the match used.
async function visits(
  chrome: ReturnType<typeof fakeChrome>['chrome'],
  args: { text: string; days: number; match?: string },
) {
  const answer = await createHistorySearch(chrome, () => NOW)(args);
  expect(answer.match).toBe(args.match ?? 'exact');
  return answer.visits;
}

describe('history search', () => {
  it('asks Chrome for the whole time range', async () => {
    const { chrome, search } = fakeChrome([]);
    await visits(chrome, { text: 'x', days: 3 });
    expect(search).toHaveBeenCalledWith({
      text: '',
      startTime: NOW - 3 * DAY,
      maxResults: 20000,
    });
  });

  it('by default keeps only the exact address, ignoring case and a trailing slash', async () => {
    const { chrome } = fakeChrome([
      { url: 'https://FlowSummit.com/register/', lastVisitTime: 1 },
      { url: 'https://flowsummit.com/register/day-1', lastVisitTime: 2 },
    ]);
    const found = await visits(chrome, {
      text: ' https://flowsummit.com/register ',
      days: 1,
    });
    expect(found.map((page) => page.url)).toEqual([
      'https://FlowSummit.com/register/',
    ]);
  });

  it('matches exactly without https:// or www. typed', async () => {
    const { chrome } = fakeChrome([
      {
        url: 'https://www.flowsummitcesko.com/speaker-posts/',
        lastVisitTime: 1,
      },
      {
        url: 'https://flowsummitcesko.com/speaker-posts/?fbclid=1',
        lastVisitTime: 2,
      },
      { url: 'https://flowsummitcesko.com/', lastVisitTime: 3 },
    ]);
    const found = await visits(chrome, {
      text: 'flowsummitcesko.com/speaker-posts/',
      days: 30,
    });
    expect(found.map((page) => page.url)).toEqual([
      'https://www.flowsummitcesko.com/speaker-posts/',
    ]);
  });

  it('with contains, keeps every address that has the text, ignoring case', async () => {
    const { chrome } = fakeChrome([
      { url: 'https://www.FlowSummit.com/a', title: 'A', lastVisitTime: 1 },
      {
        url: 'https://other.com/',
        title: 'The flowsummit replay',
        lastVisitTime: 3,
      },
      { url: 'https://flowsummit.com/b', lastVisitTime: 2 },
    ]);
    const found = await visits(chrome, {
      text: 'flowsummit',
      days: 1,
      match: 'contains',
    });
    expect(found.map((page) => page.url)).toEqual([
      'https://flowsummit.com/b',
      'https://www.FlowSummit.com/a',
    ]);
  });

  it('keeps every web page when there is no text, newest first', async () => {
    const { chrome } = fakeChrome([
      { url: 'https://a.com/', lastVisitTime: 1 },
      { url: 'chrome://settings/', lastVisitTime: 5 },
      { url: 'https://b.com/', lastVisitTime: 2.6 },
    ]);
    expect(await visits(chrome, { text: '', days: 1 })).toEqual([
      { url: 'https://b.com/', title: '', lastVisit: 3 },
      { url: 'https://a.com/', title: '', lastVisit: 1 },
    ]);
  });

  it('keeps one row per address, with its latest visit', async () => {
    const { chrome } = fakeChrome([
      { url: 'https://a.com/', title: 'Old', lastVisitTime: 1 },
      { url: 'https://a.com/', title: 'New', lastVisitTime: 9 },
      { url: 'https://a.com/', title: 'Middle', lastVisitTime: 5 },
    ]);
    expect(await visits(chrome, { text: '', days: 1 })).toEqual([
      { url: 'https://a.com/', title: 'New', lastVisit: 9 },
    ]);
  });

  it('sends back at most MAX_RESULTS pages', async () => {
    const many = Array.from({ length: MAX_RESULTS + 5 }, (_, i) => ({
      url: `https://a.com/${i}`,
      lastVisitTime: i,
    }));
    const { chrome } = fakeChrome(many);
    const found = await visits(chrome, { text: '', days: 1 });
    expect(found).toHaveLength(MAX_RESULTS);
  });

  it('refuses a range outside 1 to 3650 days', async () => {
    const { chrome } = fakeChrome([]);
    const search = createHistorySearch(chrome, () => NOW);
    await expect(search({ text: '', days: 0 })).rejects.toThrow();
    await expect(search({ text: '', days: 3651 })).rejects.toThrow();
    await expect(
      search({ text: '', days: 1, match: 'fuzzy' }),
    ).rejects.toThrow();
  });
});
