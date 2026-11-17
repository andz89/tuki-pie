import { z } from 'zod';
import type { PageReport } from '../../shared/schemas/page-info.schema';
import type { InfoCardPage, InfoCardStatus } from '../../shared/types';
import { buildPageReport } from '../page-info/page-report';

// Ctrl+Tab through several tabs reads only the one you stop on.
export const FOLLOW_TAB_MS = 300;
// Reading runs a script in the page; a busy page can take a moment.
export const READ_LIMIT_MS = 8000;
const MAX_H1S = 5;

// What readActive answers for a web page. null: no web page in front.
const Answer = z.object({ url: z.string(), page: z.unknown() }).nullable();

// The card's few things, taken from the same report Web Page shows.
export function cardPage(report: PageReport): InfoCardPage {
  const h1s = report.seo.headings.items
    .filter(({ level }) => level === 1)
    .slice(0, MAX_H1S)
    .map(({ text }) => text);
  return {
    url: report.url,
    title: report.meta.title,
    description: report.meta.description,
    canonical: report.meta.canonical,
    lang: report.meta.lang,
    h1Count: report.seo.h1Count,
    h1s,
    linkCount: report.links.length,
    imageCount: report.images.length,
    issueCount: report.issues.length,
    trackers: report.tracking.trackers.map(({ name }) => name),
    utmTagged: report.tracking.utm.taggedCount,
    hyvorTalk: report.hyvorTalk
      ? { attributes: report.hyvorTalk.attributes }
      : null,
    featuredImages: report.featuredImages,
    links: report.links,
    images: report.images,
  };
}

export interface CardReading {
  status: InfoCardStatus;
  page: InfoCardPage | null;
  // Grows with each page shown, so pictures of an old page are forgotten.
  pageId: number;
}

interface Deps {
  isConnected: () => boolean;
  readActive: () => Promise<unknown>;
  changed: (reading: CardReading) => void;
}

// Reads the tab in front in Chrome, now and each time it changes.
export class InfoCardReader {
  private reading: CardReading = { status: 'reading', page: null, pageId: 0 };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private turn = 0;
  private stopped = false;

  constructor(private readonly deps: Deps) {}

  current(): CardReading {
    return this.reading;
  }

  // Chrome said the tab in front changed: read it once things settle.
  tabChanged(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.read(), FOLLOW_TAB_MS);
  }

  async read(): Promise<void> {
    clearTimeout(this.timer);
    const turn = ++this.turn;
    if (!this.deps.isConnected()) {
      this.set({ status: 'not-connected', page: null });
      return;
    }
    this.set({ status: 'reading', page: this.reading.page });
    const next = await this.ask();
    // A newer read started, or the card closed, while this one waited.
    if (turn === this.turn && !this.stopped) {
      this.set(next);
    }
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  private async ask(): Promise<Omit<CardReading, 'pageId'>> {
    try {
      const answer = Answer.parse(await this.deps.readActive());
      if (answer === null) {
        return { status: 'no-page', page: null };
      }
      const report = buildPageReport(answer.page);
      return report
        ? { status: 'ready', page: cardPage(report) }
        : { status: 'failed', page: null };
    } catch {
      return { status: 'failed', page: null };
    }
  }

  private set({ status, page }: Omit<CardReading, 'pageId'>): void {
    const pageId =
      page === this.reading.page
        ? this.reading.pageId
        : this.reading.pageId + 1;
    this.reading = { status, page, pageId };
    this.deps.changed(this.reading);
  }
}
