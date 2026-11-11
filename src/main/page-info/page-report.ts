import {
  checkHeadings,
  checkHreflang,
  checkMetaLengths,
  checkRobots,
  checkUtmLinks,
  detectTrackers,
  findMixedContent,
  limitList,
} from '../../shared/page-audit';
import { collectIssues } from '../../shared/page-issues';
import { PageData } from '../../shared/schemas/page-info.schema';
import type { PageReport } from '../../shared/schemas/page-info.schema';

const HEADINGS_LIMIT = 200;
const HREFLANG_LIMIT = 100;

// Null means the page sent back something other than the expected data.
export function buildPageReport(raw: unknown): PageReport | null {
  const parsed = PageData.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const { url, meta, robots, headings, hreflang, resources } = parsed.data;
  const { trackingSources, linkHrefs, unsafeBlankLinks } = parsed.data;
  const { featuredImages, images, hyvorTalk, links } = parsed.data;

  const utm = checkUtmLinks(linkHrefs);
  const seo = {
    issues: [
      ...checkMetaLengths(meta),
      ...checkRobots(robots),
      ...checkHeadings(headings),
      ...checkHreflang(hreflang, { pageUrl: url, canonical: meta.canonical }),
    ],
    robots,
    headings: limitList(headings, HEADINGS_LIMIT),
    hreflang: limitList(hreflang, HREFLANG_LIMIT),
  };
  const tracking = {
    trackers: detectTrackers(trackingSources),
    utm: { ...utm, problems: limitList(utm.problems) },
    mixedContent: limitList(findMixedContent(url, resources)),
    unsafeBlankLinks: limitList(unsafeBlankLinks),
  };

  return {
    url,
    meta,
    links,
    seo,
    tracking,
    featuredImages,
    images,
    hyvorTalk,
    issues: collectIssues({ seo, tracking }),
  };
}
