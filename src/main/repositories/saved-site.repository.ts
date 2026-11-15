import type Database from 'better-sqlite3';
import type { PageReport } from '../../shared/schemas/page-info.schema';
import type {
  SavedSite,
  SavedSiteSummary,
} from '../../shared/schemas/saved-site.schema';

interface SavedSiteRow {
  id: string;
  address: string;
  title: string;
  note: string;
  has_screenshot: number;
  saved_at: string;
}

const SUMMARY = 'id, address, title, note, has_screenshot, saved_at';

const toSummary = (row: SavedSiteRow): SavedSiteSummary => ({
  id: row.id,
  address: row.address,
  title: row.title,
  note: row.note,
  hasScreenshot: row.has_screenshot === 1,
  savedAt: row.saved_at,
});

// Results saved by this app, read back. A damaged row is left out rather
// than shown half-drawn.
function readReport(text: string): PageReport | null {
  try {
    const report = JSON.parse(text) as PageReport;
    return typeof report?.url === 'string' &&
      Array.isArray(report.links) &&
      typeof report.seo === 'object'
      ? report
      : null;
  } catch {
    return null;
  }
}

export interface NewSavedSite {
  id: string;
  address: string;
  title: string;
  report: PageReport;
  hasScreenshot: boolean;
  savedAt: string;
}

export class SavedSiteRepository {
  constructor(private readonly db: Database.Database) {}

  // The most recently saved first.
  findAll(): SavedSiteSummary[] {
    const rows = this.db
      .prepare(
        `SELECT ${SUMMARY} FROM saved_sites ORDER BY saved_at DESC, rowid DESC`,
      )
      .all() as SavedSiteRow[];
    return rows.map(toSummary);
  }

  findSummary(id: string): SavedSiteSummary | null {
    const row = this.db
      .prepare(`SELECT ${SUMMARY} FROM saved_sites WHERE id = ?`)
      .get(id) as SavedSiteRow | undefined;
    return row ? toSummary(row) : null;
  }

  findByAddress(address: string): SavedSiteSummary | null {
    const row = this.db
      .prepare(`SELECT ${SUMMARY} FROM saved_sites WHERE address = ?`)
      .get(address) as SavedSiteRow | undefined;
    return row ? toSummary(row) : null;
  }

  findById(id: string): SavedSite | null {
    const row = this.db
      .prepare(`SELECT ${SUMMARY}, report FROM saved_sites WHERE id = ?`)
      .get(id) as (SavedSiteRow & { report: string }) | undefined;
    const report = row ? readReport(row.report) : null;
    return row && report ? { ...toSummary(row), report } : null;
  }

  insert(site: NewSavedSite): void {
    this.db
      .prepare(
        'INSERT INTO saved_sites (id, address, title, report, has_screenshot, saved_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        site.id,
        site.address,
        site.title,
        JSON.stringify(site.report),
        site.hasScreenshot ? 1 : 0,
        site.savedAt,
      );
  }

  // New results for a saved address. The note stays.
  replace(site: NewSavedSite): void {
    this.db
      .prepare(
        'UPDATE saved_sites SET title = ?, report = ?, has_screenshot = ?, saved_at = ? WHERE id = ?',
      )
      .run(
        site.title,
        JSON.stringify(site.report),
        site.hasScreenshot ? 1 : 0,
        site.savedAt,
        site.id,
      );
  }

  setNote(id: string, note: string): void {
    this.db
      .prepare('UPDATE saved_sites SET note = ? WHERE id = ?')
      .run(note, id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM saved_sites WHERE id = ?').run(id);
  }
}
