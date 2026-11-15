import type {
  PageInfoUpdate,
  SiteTabList,
  SiteTabSummary,
} from '../../shared/types';
import type { PageInfoController } from './page-info-controller';

const NEW_TAB = 'New tab';

// One tab across the top of the Page Info window: its own checks, and its
// own Chrome tab.
export interface OpenSiteTab {
  controller: PageInfoController;
  // Closes the Chrome tab the extension opened for it.
  forget: () => void;
  destroy: () => void;
}

export interface PageInfoTabsOptions<T extends OpenSiteTab> {
  // Makes a tab. Its controller reports every change through `send`.
  make: (id: string, send: (update: PageInfoUpdate) => void) => T;
  // The active tab's state, for the window to draw.
  sendUpdate: (update: PageInfoUpdate) => void;
  sendTabs: (tabs: SiteTabList) => void;
}

function summary(id: string, update: PageInfoUpdate): SiteTabSummary {
  return {
    id,
    title: update.report?.meta.title?.trim() || update.address || NEW_TAB,
    address: update.address,
    status: update.status,
  };
}

// The site tabs in the Page Info window. There is always at least one.
// T carries whatever else a tab owns, such as its image cache.
export class PageInfoTabs<T extends OpenSiteTab = OpenSiteTab> {
  private readonly open: { id: string; tab: T }[] = [];
  private activeId = '';
  private lastId = 0;
  private lastSent = '';
  private isDisposed = false;

  constructor(private readonly options: PageInfoTabsOptions<T>) {
    this.add();
  }

  activeTab(): T {
    return this.find(this.activeId);
  }

  active(): PageInfoController {
    return this.activeTab().controller;
  }

  controllers(): PageInfoController[] {
    return this.open.map(({ tab }) => tab.controller);
  }

  list(): SiteTabList {
    return {
      tabs: this.open.map(({ id, tab }) => summary(id, tab.controller.state())),
      activeId: this.activeId,
    };
  }

  // Opens a tab after the others and makes it the active one. With an
  // address, the tab checks it at once; an address that is refused leaves
  // no tab behind.
  add(address?: string): PageInfoController {
    this.lastId += 1;
    const id = String(this.lastId);
    const tab = this.options.make(id, (update) => this.changed(id, update));
    this.open.push({ id, tab });
    if (address !== undefined) {
      try {
        tab.controller.check(address);
      } catch (error) {
        this.open.pop();
        this.end(tab);
        throw error;
      }
    }
    this.show(id);
    return tab.controller;
  }

  // The tab to its right takes its place, or the one to its left. The last
  // tab is replaced by an empty one.
  close(id: string): void {
    const index = this.open.findIndex((each) => each.id === id);
    if (index === -1) {
      return;
    }
    const [{ tab }] = this.open.splice(index, 1);
    if (id === this.activeId) {
      this.hideViewer(tab);
    }
    this.end(tab);
    if (this.open.length === 0) {
      this.add();
      return;
    }
    if (id === this.activeId) {
      this.show(this.open[Math.min(index, this.open.length - 1)].id);
    } else {
      this.sendTabs();
    }
  }

  switchTo(id: string): void {
    if (id === this.activeId || !this.open.some((each) => each.id === id)) {
      return;
    }
    this.hideViewer(this.activeTab());
    this.show(id);
  }

  // The window closed: every tab ends, with the Chrome tabs opened for them.
  dispose(): void {
    this.isDisposed = true;
    for (const { tab } of this.open.splice(0)) {
      this.end(tab);
    }
  }

  private find(id: string): T {
    const found = this.open.find((each) => each.id === id);
    if (!found) {
      throw new Error(`No tab ${id}`);
    }
    return found.tab;
  }

  // The in-app viewer is shared, and shows the active tab's page only.
  private hideViewer(tab: T): void {
    if (tab.controller.state().siteVisible) {
      tab.controller.setSiteVisible(false);
    }
  }

  private end(tab: T): void {
    tab.controller.dispose();
    tab.destroy();
    tab.forget();
  }

  // The state goes first: the window keeps the previous tab's screenshot
  // under its id, and lets it go once the strip no longer lists that id.
  private show(id: string): void {
    this.activeId = id;
    this.options.sendUpdate(this.active().state());
    this.sendTabs();
  }

  private changed(id: string, update: PageInfoUpdate): void {
    if (this.isDisposed) {
      return;
    }
    if (id === this.activeId) {
      this.options.sendUpdate(update);
    }
    this.sendTabs();
  }

  // Only when the strip really changed: a page is read three times.
  private sendTabs(): void {
    const tabs = this.list();
    const text = JSON.stringify(tabs);
    if (text !== this.lastSent) {
      this.lastSent = text;
      this.options.sendTabs(tabs);
    }
  }
}
