import { randomUUID } from 'node:crypto';
import type { PageReport } from '../../shared/schemas/page-info.schema';
import type {
  SaveSiteResult,
  SavedSite,
  SavedSiteSummary,
} from '../../shared/schemas/saved-site.schema';
import type { SavedSiteRepository } from '../repositories/saved-site.repository';
import { UserError } from './user-error';

const GONE = 'That saved site no longer exists.';

// Where saved screenshots live: one JPEG per saved site, by its id.
export interface ScreenshotFiles {
  write(id: string, jpeg: Buffer): Promise<void>;
  read(id: string): Promise<Buffer | null>;
  remove(id: string): Promise<void>;
}

// What the Page Info tab holds when you press Save.
export interface SiteToSave {
  report: PageReport;
  jpeg: Buffer | null;
}

export class SavedSiteService {
  private readonly listeners = new Set<() => void>();
  // Saves run one after another: two at once for a new address would both
  // find nothing saved, and the second would hit the address's uniqueness.
  private saving: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly sites: SavedSiteRepository,
    private readonly files: ScreenshotFiles,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Told after every change, so every open list catches up.
  onChanged(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): SavedSiteSummary[] {
    return this.sites.findAll();
  }

  get(id: string): SavedSite {
    const site = this.sites.findById(id);
    if (!site) {
      throw new UserError(GONE);
    }
    return site;
  }

  // The site, without its results. Enough for its title and address.
  find(id: string): SavedSiteSummary {
    const site = this.sites.findSummary(id);
    if (!site) {
      throw new UserError(GONE);
    }
    return site;
  }

  // An address already saved is only replaced when asked to; the note stays.
  save(site: SiteToSave, replace: boolean): Promise<SaveSiteResult> {
    const next = this.saving
      .catch(() => undefined)
      .then(() => this.write(site, replace));
    this.saving = next;
    return next;
  }

  private async write(
    { report, jpeg }: SiteToSave,
    replace: boolean,
  ): Promise<SaveSiteResult> {
    const existing = this.sites.findByAddress(report.url);
    if (existing && !replace) {
      return { status: 'exists', site: existing };
    }
    const site = {
      id: existing?.id ?? randomUUID(),
      address: report.url,
      title: report.meta.title?.trim() || report.url,
      report,
      hasScreenshot: jpeg !== null,
      savedAt: this.now().toISOString(),
    };
    if (jpeg) {
      await this.files.write(site.id, jpeg);
    } else if (existing?.hasScreenshot) {
      await this.files.remove(site.id);
    }
    if (existing) {
      this.sites.replace(site);
    } else {
      this.sites.insert(site);
    }
    this.changed();
    return {
      status: existing ? 'replaced' : 'saved',
      site: this.find(site.id),
    };
  }

  setNote(id: string, note: string): void {
    this.find(id);
    this.sites.setNote(id, note);
    this.changed();
  }

  async remove(id: string): Promise<void> {
    const site = this.sites.findSummary(id);
    if (!site) {
      return;
    }
    this.sites.remove(id);
    if (site.hasScreenshot) {
      await this.files.remove(id);
    }
    this.changed();
  }

  async screenshot(id: string): Promise<Buffer | null> {
    return this.find(id).hasScreenshot ? this.files.read(id) : null;
  }

  private changed(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
