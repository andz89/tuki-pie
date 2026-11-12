import { z } from 'zod';
import type { PageImage, PageImageSize } from '../../shared/types';

// Chrome fetches several images side by side; more would only queue there.
export const MAX_AT_ONCE = 4;

const TIME_LIMIT_MS: Record<PageImageSize, number> = {
  thumb: 15000,
  full: 30000,
};

// What the extension sends back. Only an image data address is shown.
const Answer = z.object({
  dataUrl: z.string().regex(/^data:image\/[a-z0-9.+-]+;base64,/i),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export interface CurrentPage {
  reportId: number;
  url: string;
  images: string[];
  featuredImages: string[];
}

interface Deps {
  request: (
    action: string,
    args: Record<string, unknown>,
    timeoutMs: number,
  ) => Promise<unknown>;
  // The page Page Info shows now, or null before a check.
  currentPage: () => CurrentPage | null;
}

// The checked page's images, fetched by Chrome. Only addresses on that page
// are asked for, so a script that got into the Page Info window can't make
// Chrome fetch anything else. Each picture is fetched once per page.
export class PageImages {
  private cachedFor: number | null = null;
  private cache = new Map<string, Promise<PageImage | null>>();
  private allowed = new Set<string>();
  private running = 0;
  private waiting: Array<() => void> = [];

  constructor(private readonly deps: Deps) {}

  // Null when the address isn't on the page, or Chrome couldn't get a
  // picture: the window shows it as broken.
  get(url: string, size: PageImageSize): Promise<PageImage | null> {
    const page = this.deps.currentPage();
    if (page === null) {
      return Promise.resolve(null);
    }
    this.follow(page);
    if (!this.allowed.has(url)) {
      return Promise.resolve(null);
    }
    const key = `${size} ${url}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const image = this.inTurn(() => this.ask(url, size));
    this.cache.set(key, image);
    return image;
  }

  // A new page forgets the old one's pictures and addresses.
  private follow(page: CurrentPage): void {
    if (this.cachedFor === page.reportId) {
      return;
    }
    this.cachedFor = page.reportId;
    this.cache.clear();
    this.allowed = new Set(
      [...page.images, ...page.featuredImages]
        .map((address) => resolved(address, page.url))
        .filter((address): address is string => address !== null),
    );
  }

  private async ask(
    url: string,
    size: PageImageSize,
  ): Promise<PageImage | null> {
    try {
      const answer = Answer.safeParse(
        await this.deps.request('image', { url, size }, TIME_LIMIT_MS[size]),
      );
      return answer.success ? answer.data : null;
    } catch {
      return null;
    }
  }

  private async inTurn<Value>(run: () => Promise<Value>): Promise<Value> {
    if (this.running >= MAX_AT_ONCE) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running += 1;
    try {
      return await run();
    } finally {
      this.running -= 1;
      this.waiting.shift()?.();
    }
  }
}

function resolved(address: string, pageUrl: string): string | null {
  return URL.canParse(address, pageUrl) ? new URL(address, pageUrl).href : null;
}
