import type { DetectedTracker, PageIssue } from './page-audit';

export interface IssueSources {
  seo: { issues: PageIssue[] };
  tracking: {
    trackers: DetectedTracker[];
    utm: { problems: { total: number } };
    mixedContent: { total: number };
    unsafeBlankLinks: { total: number };
  };
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

const LEVEL_ORDER: Record<PageIssue['level'], number> = {
  error: 0,
  warning: 1,
};

// Every problem found on the page, in one list, errors first.
export function collectIssues({ seo, tracking }: IssueSources): PageIssue[] {
  const issues = [...seo.issues];
  const mixed = tracking.mixedContent.total;
  const utmProblems = tracking.utm.problems.total;
  const blankLinks = tracking.unsafeBlankLinks.total;

  if (mixed > 0) {
    issues.push({
      level: 'error',
      area: 'Mixed content',
      message: `${plural(mixed, 'file')} ${mixed === 1 ? 'loads' : 'load'} over http on this https page. Browsers may block them.`,
    });
  }
  for (const { name, duplicateSrcs } of tracking.trackers) {
    for (const { count } of duplicateSrcs) {
      issues.push({
        level: 'warning',
        area: name,
        message: `Script is loaded ${count} times. This can count visits twice.`,
      });
    }
  }
  if (utmProblems > 0) {
    issues.push({
      level: 'warning',
      area: 'UTM',
      message: `${plural(utmProblems, 'link')} missing source, medium or campaign.`,
    });
  }
  if (blankLinks > 0) {
    issues.push({
      level: 'warning',
      area: 'Links',
      message: `${plural(blankLinks, 'link')} ${blankLinks === 1 ? 'opens' : 'open'} a new tab without rel="noopener".`,
    });
  }

  return issues.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
