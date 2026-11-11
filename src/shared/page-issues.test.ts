import { describe, expect, it } from 'vitest';
import type { DetectedTracker } from './page-audit';
import { collectIssues } from './page-issues';
import type { IssueSources } from './page-issues';

function report(changes: {
  seoWarning?: boolean;
  mixed?: number;
  trackers?: DetectedTracker[];
  utmProblems?: number;
  blankLinks?: number;
}): IssueSources {
  return {
    seo: {
      issues: changes.seoWarning
        ? [{ level: 'warning', area: 'Title', message: 'Too long.' }]
        : [],
    },
    tracking: {
      trackers: changes.trackers ?? [],
      utm: { problems: { total: changes.utmProblems ?? 0 } },
      mixedContent: { total: changes.mixed ?? 0 },
      unsafeBlankLinks: { total: changes.blankLinks ?? 0 },
    },
  };
}

describe('collectIssues', () => {
  it('lists errors first', () => {
    const [first] = collectIssues(report({ seoWarning: true, mixed: 2 }));
    expect(first).toMatchObject({ level: 'error', area: 'Mixed content' });
  });

  it('counts files in the message', () => {
    const [first] = collectIssues(report({ mixed: 2 }));
    expect(first.message).toContain('2 files load over http');
  });

  it('uses the singular for one file', () => {
    const [first] = collectIssues(report({ mixed: 1 }));
    expect(first.message).toContain('1 file loads over http');
  });

  it('warns about a script loaded more than once', () => {
    const [first] = collectIssues(
      report({
        trackers: [
          {
            name: 'Hotjar',
            ids: [],
            duplicateSrcs: [{ src: 'https://a.com/x.js', count: 3 }],
          },
        ],
      }),
    );
    expect(first).toMatchObject({ level: 'warning', area: 'Hotjar' });
    expect(first.message).toContain('Script is loaded 3 times');
  });

  it('warns about UTM problems', () => {
    expect(collectIssues(report({ utmProblems: 2 }))).toEqual([
      {
        level: 'warning',
        area: 'UTM',
        message: '2 links missing source, medium or campaign.',
      },
    ]);
  });

  it('warns about new-tab links without noopener', () => {
    const [first] = collectIssues(report({ blankLinks: 1 }));
    expect(first).toMatchObject({ level: 'warning', area: 'Links' });
  });

  it('finds nothing on a clean page', () => {
    expect(collectIssues(report({}))).toEqual([]);
  });
});
