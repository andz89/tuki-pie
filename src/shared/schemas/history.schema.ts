import { z } from 'zod';
import { MAX_PAGE_URL } from './page-info.schema';

// Page Info's History: pages visited in Chrome in the last N days.
export const MAX_HISTORY_DAYS = 3650;
export const MAX_HISTORY_TEXT = 200;
export const MAX_HISTORY_RESULTS = 1000;

// exact: the address is the text. contains: the address has the text in it.
export const HistoryMatch = z.enum(['exact', 'contains']);
export type HistoryMatch = z.infer<typeof HistoryMatch>;

export const HistoryVisit = z.object({
  url: z.string().max(MAX_PAGE_URL),
  title: z.string().max(500),
  // Milliseconds since 1970.
  lastVisit: z.number(),
});
export type HistoryVisit = z.infer<typeof HistoryVisit>;

// The extension's answer, with the match it applied.
export const HistoryAnswer = z.object({
  match: HistoryMatch,
  visits: z.array(HistoryVisit).max(MAX_HISTORY_RESULTS),
});
