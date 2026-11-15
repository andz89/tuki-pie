import { z } from 'zod';
import type { PageReport } from './page-info.schema';

// A note on a saved site is short text, like a reminder to yourself.
export const MAX_SAVED_NOTE = 20000;

export const SavedSiteId = z.string().uuid();
export const SavedSiteNote = z.string().max(MAX_SAVED_NOTE);

// One saved site in the list, without its results.
export interface SavedSiteSummary {
  id: string;
  address: string;
  title: string;
  note: string;
  hasScreenshot: boolean;
  // ISO time of the last save.
  savedAt: string;
}

// A saved site with the results kept from that moment.
export interface SavedSite extends SavedSiteSummary {
  report: PageReport;
}

// What Save did. `exists`: the address was already saved, and nothing
// changed until you choose to replace it.
export type SaveSiteResult =
  | { status: 'saved' | 'replaced'; site: SavedSiteSummary }
  | { status: 'exists'; site: SavedSiteSummary };
