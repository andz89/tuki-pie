import { describe, expect, it, vi } from 'vitest';
import {
  COULD_NOT_READ,
  HISTORY_MS,
  NOT_CONNECTED,
  searchChromeHistory,
} from './chrome-history';

function bridge(answer: () => Promise<unknown>, status = 'connected') {
  return {
    status: () => status as 'connected',
    request: vi.fn(answer),
  };
}

describe('searchChromeHistory', () => {
  it('asks the extension and returns the pages', async () => {
    const visit = { url: 'https://a.com/', title: 'A', lastVisit: 5 };
    const chrome = bridge(async () => ({ match: 'contains', visits: [visit] }));
    expect(await searchChromeHistory(chrome, 'a', 2, 'contains')).toEqual([
      visit,
    ]);
    expect(chrome.request).toHaveBeenCalledWith(
      'history',
      { text: 'a', days: 2, match: 'contains' },
      HISTORY_MS,
    );
  });

  it('says so when Chrome is not connected', async () => {
    await expect(
      searchChromeHistory(
        bridge(async () => [], 'disconnected'),
        '',
        1,
        'exact',
      ),
    ).rejects.toThrow(NOT_CONNECTED);
    await expect(searchChromeHistory(null, '', 1, 'exact')).rejects.toThrow(
      NOT_CONNECTED,
    );
  });

  it('refuses an answer from an extension too old to know the match', async () => {
    await expect(
      searchChromeHistory(
        bridge(async () => []),
        'a',
        1,
        'exact',
      ),
    ).rejects.toThrow(COULD_NOT_READ);
    await expect(
      searchChromeHistory(
        bridge(async () => ({ match: 'contains', visits: [] })),
        'a',
        1,
        'exact',
      ),
    ).rejects.toThrow(COULD_NOT_READ);
  });

  it('says so when the extension fails or answers oddly', async () => {
    await expect(
      searchChromeHistory(
        bridge(() => Promise.reject(new Error('failed'))),
        '',
        1,
        'exact',
      ),
    ).rejects.toThrow(COULD_NOT_READ);
    await expect(
      searchChromeHistory(
        bridge(async () => [{ url: 5 }]),
        '',
        1,
        'exact',
      ),
    ).rejects.toThrow(COULD_NOT_READ);
  });
});
