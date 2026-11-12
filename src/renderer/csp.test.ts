import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, withContentSecurityPolicy } from './csp';

const PAGES = readdirSync(__dirname).filter((file) => file.endsWith('.html'));

function policyOf(html: string): string | null {
  return (
    /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(
      html,
    )?.[1] ?? null
  );
}

describe('the security policy', () => {
  it('finds every renderer page', () => {
    expect(PAGES).toEqual(
      expect.arrayContaining([
        'index.html',
        'panel.html',
        'notes.html',
        'page-info.html',
        'reminder.html',
        'screenshot.html',
      ]),
    );
  });

  it.each(PAGES)('is added to %s', (page) => {
    const html = readFileSync(path.join(__dirname, page), 'utf8');
    const policy = policyOf(withContentSecurityPolicy(html, page, false));
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src 'self';");
  });

  it('allows no inline scripts in a build', () => {
    expect(contentSecurityPolicy('index.html', false)).not.toMatch(
      /script-src[^;]*unsafe-inline/,
    );
  });

  it('allows the dev server its inline script and socket', () => {
    const policy = contentSecurityPolicy('index.html', true);
    expect(policy).toMatch(/script-src 'self' 'unsafe-inline'/);
    expect(policy).toContain('ws://localhost:*');
  });

  it.each(PAGES)('lets %s show no image from another site', (page) => {
    const policy = contentSecurityPolicy(page, false);
    expect(policy).toContain("img-src 'self' data: blob:;");
    expect(policy).not.toMatch(/img-src[^;]*https?:/);
  });

  it('refuses a page without a head', () => {
    expect(() =>
      withContentSecurityPolicy('<html></html>', 'x.html', false),
    ).toThrow(/no <head>/);
  });
});
