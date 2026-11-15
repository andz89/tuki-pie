import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { PageReport } from '../../shared/schemas/page-info.schema';
import { migrate } from '../db/migrate';
import { SavedSiteRepository } from '../repositories/saved-site.repository';
import { SavedSiteService } from './saved-site.service';
import type { ScreenshotFiles } from './saved-site.service';

const report = (url: string, title: string | null = 'Shop'): PageReport =>
  ({
    url,
    meta: { title, description: null, lang: null, canonical: null },
    links: [{ href: `${url}about`, hidden: false }],
    seo: { issues: [] },
  }) as unknown as PageReport;

let db: Database.Database;
let repository: SavedSiteRepository;
let files: { [Key in keyof ScreenshotFiles]: Mock<ScreenshotFiles[Key]> };
let clock: Date;
let service: SavedSiteService;

beforeEach(() => {
  db = new Database(':memory:');
  migrate(db);
  repository = new SavedSiteRepository(db);
  files = {
    write: vi.fn<ScreenshotFiles['write']>(async () => undefined),
    read: vi.fn<ScreenshotFiles['read']>(async () => Buffer.from('jpeg')),
    remove: vi.fn<ScreenshotFiles['remove']>(async () => undefined),
  };
  clock = new Date('2026-11-15T10:00:00Z');
  service = new SavedSiteService(repository, files, () => clock);
});

describe('saving a site', () => {
  it('keeps the results, title and time', async () => {
    const result = await service.save(
      { report: report('https://a.com/'), jpeg: null },
      false,
    );
    expect(result).toMatchObject({
      status: 'saved',
      site: {
        address: 'https://a.com/',
        title: 'Shop',
        note: '',
        hasScreenshot: false,
        savedAt: '2026-11-15T10:00:00.000Z',
      },
    });
    expect(service.get(result.site.id).report.links).toHaveLength(1);
    expect(files.write).not.toHaveBeenCalled();
  });

  it('uses the address when the page has no title', async () => {
    const { site } = await service.save(
      { report: report('https://a.com/', '  '), jpeg: null },
      false,
    );
    expect(site.title).toBe('https://a.com/');
  });

  it('writes the screenshot as a file', async () => {
    const jpeg = Buffer.from('picture');
    const { site } = await service.save(
      { report: report('https://a.com/'), jpeg },
      false,
    );
    expect(site.hasScreenshot).toBe(true);
    expect(files.write).toHaveBeenCalledWith(site.id, jpeg);
    await expect(service.screenshot(site.id)).resolves.toEqual(
      Buffer.from('jpeg'),
    );
  });

  it('asks before replacing a saved address, and changes nothing', async () => {
    const first = await service.save(
      { report: report('https://a.com/'), jpeg: null },
      false,
    );
    clock = new Date('2026-11-16T10:00:00Z');
    const again = await service.save(
      { report: report('https://a.com/', 'New'), jpeg: null },
      false,
    );
    expect(again).toEqual({ status: 'exists', site: first.site });
    expect(service.list()).toHaveLength(1);
  });

  it('replaces the results and keeps the note when asked', async () => {
    const { site } = await service.save(
      { report: report('https://a.com/'), jpeg: Buffer.from('old') },
      false,
    );
    service.setNote(site.id, 'Check GA4');
    clock = new Date('2026-11-16T10:00:00Z');
    const replaced = await service.save(
      { report: report('https://a.com/', 'New'), jpeg: null },
      true,
    );
    expect(replaced).toMatchObject({
      status: 'replaced',
      site: {
        id: site.id,
        title: 'New',
        note: 'Check GA4',
        hasScreenshot: false,
        savedAt: '2026-11-16T10:00:00.000Z',
      },
    });
    expect(files.remove).toHaveBeenCalledWith(site.id);
  });

  it('saves the same new address twice in a row, not twice at once', async () => {
    const [first, second] = await Promise.all([
      service.save(
        { report: report('https://a.com/'), jpeg: Buffer.from('1') },
        false,
      ),
      service.save(
        { report: report('https://a.com/'), jpeg: Buffer.from('2') },
        false,
      ),
    ]);
    expect(first.status).toBe('saved');
    expect(second).toEqual({ status: 'exists', site: first.site });
    expect(service.list()).toHaveLength(1);
    expect(files.write).toHaveBeenCalledOnce();
  });

  it('tells listeners about each change', async () => {
    const listener = vi.fn();
    service.onChanged(listener);
    const { site } = await service.save(
      { report: report('https://a.com/'), jpeg: null },
      false,
    );
    service.setNote(site.id, 'x');
    await service.remove(site.id);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe('the saved list', () => {
  it('lists the most recently saved first', async () => {
    await service.save({ report: report('https://a.com/'), jpeg: null }, false);
    clock = new Date('2026-11-16T10:00:00Z');
    await service.save({ report: report('https://b.com/'), jpeg: null }, false);
    expect(service.list().map(({ address }) => address)).toEqual([
      'https://b.com/',
      'https://a.com/',
    ]);
  });

  it('removes a site with its screenshot', async () => {
    const { site } = await service.save(
      { report: report('https://a.com/'), jpeg: Buffer.from('x') },
      false,
    );
    await service.remove(site.id);
    expect(service.list()).toEqual([]);
    expect(files.remove).toHaveBeenCalledWith(site.id);
  });

  it('says when a saved site is gone', () => {
    expect(() => service.get('8b2f6a52-5c4e-4b8e-9f1a-3d2c1b0a9e8f')).toThrow(
      'That saved site no longer exists.',
    );
    expect(() => service.setNote('nope', 'x')).toThrow('no longer exists');
  });

  it('leaves out results that were damaged on disk', async () => {
    const { site } = await service.save(
      { report: report('https://a.com/'), jpeg: null },
      false,
    );
    db.prepare('UPDATE saved_sites SET report = ? WHERE id = ?').run(
      '{"broken',
      site.id,
    );
    expect(() => service.get(site.id)).toThrow('no longer exists');
  });
});
