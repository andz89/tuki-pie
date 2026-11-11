import { z } from 'zod';
import type {
  DetectedTracker,
  LimitedList,
  PageHeading,
  PageHreflang,
  PageIssue,
  PageResource,
  PageRobot,
  UtmProblem,
} from '../page-audit';

// collect-page.js trims a page to these same limits, because it can't import.
export const MAX_PAGE_URL = 2048;
export const MAX_PAGE_TEXT = 2000;
export const MAX_PAGE_LIST = 5000;
export const MAX_INLINE_SCRIPT = 200000;
export const MAX_INLINE_SCRIPTS = 500;

const Url = z.string().max(MAX_PAGE_URL);
const Text = z.string().max(MAX_PAGE_TEXT);
const list = <Item extends z.ZodType>(item: Item) =>
  z.array(item).max(MAX_PAGE_LIST);

// A page is untrusted, so everything it hands back is checked before use.
export const PageData = z.object({
  url: Url,
  meta: z.object({
    title: Text.nullable(),
    description: Text.nullable(),
    lang: Text.nullable(),
    canonical: Url.nullable(),
  }),
  robots: list(z.object({ name: Text, content: Text })),
  headings: list(
    z.object({ level: z.number().int().min(1).max(6), text: Text }),
  ),
  hreflang: list(z.object({ hreflang: Text, href: Url })),
  resources: list(z.object({ tag: Text, url: Url })),
  trackingSources: z.object({
    srcs: list(Url),
    inlineScripts: z
      .array(z.string().max(MAX_INLINE_SCRIPT))
      .max(MAX_INLINE_SCRIPTS),
  }),
  linkHrefs: list(Url),
  links: list(z.object({ href: Url, hidden: z.boolean() })),
  unsafeBlankLinks: list(Url),
  featuredImages: list(z.object({ property: Text, url: Url })),
  images: list(Url),
  hyvorTalk: z
    .object({
      tagName: Text,
      attributes: list(z.object({ name: Text, value: Text })),
    })
    .nullable(),
});

export type PageData = z.infer<typeof PageData>;

export interface PageReport {
  url: string;
  meta: PageData['meta'];
  links: PageData['links'];
  seo: {
    issues: PageIssue[];
    robots: PageRobot[];
    headings: LimitedList<PageHeading>;
    hreflang: LimitedList<PageHreflang>;
  };
  tracking: {
    trackers: DetectedTracker[];
    utm: {
      taggedCount: number;
      campaigns: string[];
      problems: LimitedList<UtmProblem>;
    };
    mixedContent: LimitedList<PageResource>;
    unsafeBlankLinks: LimitedList<string>;
  };
  featuredImages: PageData['featuredImages'];
  images: PageData['images'];
  hyvorTalk: PageData['hyvorTalk'];
  issues: PageIssue[];
}
