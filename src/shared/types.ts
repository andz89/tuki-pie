import type {
  DueReminder,
  NewNote,
  Note,
  NoteEdit,
  Reminder,
} from './schemas/note.schema';
import type { LinkFilter } from './link-rules';
import type { HistoryMatch, HistoryVisit } from './schemas/history.schema';
import type {
  InfoCardField,
  InfoCardLayout,
  InfoCardView,
  LinksOpenIn,
} from './schemas/info-card.schema';
import type { PageData, PageReport } from './schemas/page-info.schema';
import type {
  SaveSiteResult,
  SavedSite,
  SavedSiteSummary,
} from './schemas/saved-site.schema';
import type {
  PieLookUpdate,
  Settings,
  SettingsUpdate,
} from './schemas/settings.schema';
import type {
  NewShortcut,
  PanelFormRequest,
  Shortcut,
  ShortcutEdit,
  ShortcutType,
} from './schemas/shortcut.schema';
import type {
  NewSlice,
  Slice,
  SliceEdit,
  SliceType,
} from './schemas/slice.schema';
import type {
  NewSnippet,
  Snippet,
  SnippetEdit,
} from './schemas/snippet.schema';
import type {
  ChromeSuggestions,
  SuggestionChange,
  SuggestionGroup,
  SuggestionValue,
} from './schemas/suggestion.schema';

export type { NewSlice, Slice, SliceEdit, SliceType };
export type { NewSnippet, Snippet, SnippetEdit };
export type {
  ChromeSuggestions,
  SuggestionChange,
  SuggestionGroup,
  SuggestionValue,
};
export type { PageData, PageReport };
export type { SaveSiteResult, SavedSite, SavedSiteSummary };
export type { DueReminder, NewNote, Note, NoteEdit, Reminder };
export type {
  NewShortcut,
  PanelFormRequest,
  Shortcut,
  ShortcutEdit,
  ShortcutType,
};
export type { PieLookUpdate, Settings, SettingsUpdate };
export type { OnOff, Theme } from './schemas/settings.schema';

export type VolumeChange = 'up' | 'down' | 'mute';

// Which side of the donut the Shortcuts list opens on.
export type ListSide = 'left' | 'right';

// How much wider the donut window gets while that list is open, at normal size.
export const LIST_EXTRA_WIDTH = 220;

export type PiePhase = 'opening' | 'closing';

// The whole screen under the mouse, or a part of it the person drags out.
export type ScreenshotMode = 'screen' | 'section';

export interface ScreenArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Where Page Info reads a site: its hidden window, or a Chrome tab.
export type ChromeStatus = 'connected' | 'not-connected' | 'port-in-use';

// What the Page Info window draws for one of its tabs.
export interface PageInfoUpdate {
  // The tab this belongs to.
  tabId: string;
  status: 'idle' | 'checking' | 'done' | 'failed';
  address: string | null;
  report: PageReport | null;
  message: string | null;
  siteVisible: boolean;
  chromeConnected: boolean;
  // Changes with each new page, not with each re-read of the same one, so
  // the window keeps your ticks while late tags arrive.
  reportId: number;
}

// One tab in the strip at the top of the Page Info window.
export interface SiteTabSummary {
  id: string;
  title: string;
  address: string | null;
  status: PageInfoUpdate['status'];
}

export interface SiteTabList {
  tabs: SiteTabSummary[];
  activeId: string;
}

// A page image as Chrome fetched it: small ('thumb') or as it came ('full').
export type PageImageSize = 'thumb' | 'full';
export interface PageImage {
  dataUrl: string;
  // The original size, when Chrome decoded it.
  width: number | null;
  height: number | null;
}

// A picture of the whole checked page, for the Screenshot tab.
export interface PageScreenshot {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  stitched: boolean;
  // Why Chrome refused the one-pass capture, in its own words.
  stitchReason: string | null;
  // The device it was taken as, or "" for the tab as it is.
  device: string;
  // The CSS selector of the section taken, or "" for the whole page.
  section: string;
  // How many elements matched the section's selector (the first is taken).
  matches: number | null;
  // A small picture of the top, for the dashboard.
  thumbDataUrl: string;
}

// What is picked before taking one. reload: load the page as the device
// first, for sites that choose their mobile version on the server.
// section: a CSS selector for one part of the page, or "" for all of it.
export interface CaptureSize {
  device: string;
  reload: boolean;
  section: string;
}

// The longest section selector. The extension keeps the same limit.
export const MAX_SECTION_SELECTOR = 500;

// What "Show on page" found: the link marked, a link hidden on the page (a
// closed menu, say), or no such link any more.
export const LINK_SPOTS = ['shown', 'hidden', 'not-found'] as const;
export type LinkSpot = (typeof LINK_SPOTS)[number];

// Most links "Open all" opens at once. The extension keeps the same limit.
export const MAX_OPEN_LINKS = 100;

// The Chrome section of the settings window. Only that window receives it.
export interface ChromePairing {
  status: ChromeStatus;
  code: string;
}

// A request either works, or comes back with a message the person can read.
export type Result<Value = void> =
  | { ok: true; value: Value }
  | { ok: false; error: string };

// What the donut window can do, available to it as `window.pie`.
export interface PieBridge {
  shortcuts: {
    list(): Promise<Result<Shortcut[]>>;
    open(id: string): Promise<Result>;
    // An app's own icon, as an image address, or null when it has none.
    icon(id: string): Promise<Result<string | null>>;
  };
  snippets: {
    list(): Promise<Result<Snippet[]>>;
    copy(id: string): Promise<Result>;
  };
  settings: {
    get(): Promise<Result<Settings>>;
    // Only the look: theme, accent, size and pin.
    update(changes: PieLookUpdate): Promise<Result<Settings>>;
  };
  screenshot: {
    take(mode: ScreenshotMode): Promise<Result>;
  };
  zip: {
    // How many images were selected in Explorer when the donut opened.
    count(): Promise<Result<number>>;
    // Zips them next to the first one, as "<name>.zip".
    create(name: string): Promise<Result>;
  };
  window: {
    openShortcutForm(request: PanelFormRequest): Promise<void>;
    hide(): Promise<void>;
    dismiss(): Promise<void>;
    onPhase(listener: (phase: PiePhase) => void): () => void;
    moveBy(deltaX: number, deltaY: number): Promise<void>;
    openSettings(): Promise<void>;
    openPageInfo(): Promise<void>;
    openNotes(): Promise<void>;
    openInfoCard(): Promise<void>;
    volume(change: VolumeChange): Promise<void>;
    setListSide(side: ListSide | null): Promise<void>;
  };
}

// What the Page Info window can do, available to it as `window.pageInfo`.
export interface PageInfoBridge {
  getState(): Promise<Result<PageInfoUpdate>>;
  check(address: string): Promise<Result>;
  refresh(): Promise<Result>;
  setSiteVisible(visible: boolean): Promise<Result>;
  goToTab(): Promise<Result>;
  showLink(index: number, href: string): Promise<Result<LinkSpot | null>>;
  // ticked: links marked as carrying a token that the user ticked anyway.
  openLinks(urls: string[], ticked?: string[]): Promise<Result<boolean>>;
  setOnTop(onTop: boolean): Promise<Result<Settings>>;
  setLinkFilter(filter: LinkFilter): Promise<Result<Settings>>;
  capture(size: CaptureSize): Promise<Result<PageScreenshot>>;
  saveCapture(): Promise<Result>;
  copyCapture(): Promise<Result>;
  // A page image through Chrome; null when it couldn't be had.
  image(url: string, size: PageImageSize): Promise<Result<PageImage | null>>;
  // Pages visited in Chrome in the last `days` days whose address is `text`
  // (exact) or has it in it (contains), newest first.
  history(
    text: string,
    days: number,
    match: HistoryMatch,
  ): Promise<Result<HistoryVisit[]>>;
  onUpdate(listener: (update: PageInfoUpdate) => void): () => void;
  // The tabs across the top. A new one becomes the active one, and checks
  // the address when one is given.
  getTabs(): Promise<Result<SiteTabList>>;
  // ticked: the address is marked as carrying a token, and you ticked it.
  newTab(address: string | null, ticked?: boolean): Promise<Result>;
  closeTab(id: string): Promise<Result>;
  switchTab(id: string): Promise<Result>;
  onTabs(listener: (tabs: SiteTabList) => void): () => void;
  // Saves the active tab's site. replace: overwrite a saved address.
  saveSite(replace: boolean): Promise<Result<SaveSiteResult>>;
  openSavedSitesWindow(): Promise<Result>;
  // Main started a check in a tab: the tabs must be in view for it.
  onShowTabs(listener: () => void): () => void;
  settings: {
    get(): Promise<Result<Settings>>;
  };
}

// Saved sites, available as `window.savedSites` in the Saved sites window
// and in the Page Info window, which can show the same list in place.
export interface SavedSitesBridge {
  list(): Promise<Result<SavedSiteSummary[]>>;
  get(id: string): Promise<Result<SavedSite>>;
  setNote(id: string, note: string): Promise<Result>;
  remove(id: string): Promise<Result>;
  // Checks the saved address live, in a new tab of the Page Info window.
  openLive(id: string): Promise<Result>;
  // The saved picture as a data address, or null when none was saved.
  screenshot(id: string): Promise<Result<string | null>>;
  saveScreenshot(id: string): Promise<Result>;
  copyScreenshot(id: string): Promise<Result>;
  onChanged(listener: () => void): () => void;
  settings: {
    get(): Promise<Result<Settings>>;
  };
}

// What the Info Card shows of a page: only the few things on the card, not
// the whole report.
export interface InfoCardPage {
  url: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  lang: string | null;
  h1Count: number;
  // The first few H1s.
  h1s: string[];
  linkCount: number;
  imageCount: number;
  issueCount: number;
  trackers: string[];
  utmTagged: number;
  // The Hyvor Talk comments tag and its attributes, or null when none.
  hyvorTalk: { attributes: Array<{ name: string; value: string }> } | null;
  featuredImages: Array<{ property: string; url: string }>;
  // Every link, in page order, for the Links card.
  links: PageReport['links'];
  // Every image address, in page order, for the Images card.
  images: PageReport['images'];
}

// reading: asking Chrome; the last page stays shown meanwhile.
// no-page: the tab in front has no web page, like a new tab.
export type InfoCardStatus =
  | 'reading'
  | 'ready'
  | 'no-page'
  | 'not-connected'
  | 'failed';

export interface InfoCardState {
  status: InfoCardStatus;
  page: InfoCardPage | null;
  // Grows with each new page, so the Links card starts its ticks afresh.
  pageId: number;
  // info: the Info Card. links: the Links card, in its place.
  view: InfoCardView;
  pinned: boolean;
  layout: InfoCardLayout;
  fields: InfoCardField[];
  theme: Settings['theme'];
  // The saved Link filters, as Web Page reads them.
  linkFilter: Settings['linkFilter'];
  // Where the Links card opens links.
  linksOpenIn: LinksOpenIn;
}

// What the Info Card can do, available to it as `window.infoCard`.
export interface InfoCardBridge {
  getState(): Promise<Result<InfoCardState>>;
  setPinned(pinned: boolean): Promise<Result>;
  setLayout(layout: InfoCardLayout): Promise<Result>;
  setFields(fields: InfoCardField[]): Promise<Result>;
  image(url: string, size: PageImageSize): Promise<Result<PageImage | null>>;
  close(): Promise<Result>;
  // The page on the card, checked in full in the Web Page window.
  openInWebPage(): Promise<Result>;
  setView(view: InfoCardView): Promise<Result>;
  // The Links card's actions. Each link must be one of the card page's.
  showLink(index: number, href: string): Promise<Result<LinkSpot | null>>;
  openLinks(urls: string[], ticked: string[]): Promise<Result<boolean>>;
  // One link checked in its own Web Page tab.
  openHere(href: string, ticked: boolean): Promise<Result>;
  setLinkFilter(filter: LinkFilter): Promise<Result>;
  setLinksOpenIn(openIn: LinksOpenIn): Promise<Result>;
  // Marks these words on the page in Chrome; empty clears. How many places
  // were marked, or null when Chrome did not answer.
  highlight(text: string): Promise<Result<number | null>>;
  onUpdate(listener: (state: InfoCardState) => void): () => void;
}

// What the Notes window can do, available to it as `window.notes`.
export interface NotesBridge {
  // cleanUp: also drop notes left empty, which only the window's start asks.
  list(cleanUp: boolean): Promise<Result<Note[]>>;
  create(item: NewNote): Promise<Result<Note>>;
  update(edit: NoteEdit): Promise<Result<Note>>;
  remove(id: string): Promise<Result>;
  setReminder(id: string, reminder: Reminder | null): Promise<Result<Note>>;
  // The note the donut or a reminder card asked to show, if any.
  takeRequest(): Promise<Result<string | null>>;
  onChanged(listener: () => void): () => void;
  onOpenRequested(listener: () => void): () => void;
  // Runs before the window closes; the close waits for it, briefly.
  onSaveRequested(save: () => Promise<void>): () => void;
  settings: {
    get(): Promise<Result<Settings>>;
  };
}

// What the reminder card can do, available to it as `window.reminder`.
export interface ReminderBridge {
  list(): Promise<Result<DueReminder[]>>;
  open(id: string): Promise<Result>;
  snooze(id: string): Promise<Result>;
  done(id: string): Promise<Result>;
  fit(height: number): Promise<Result>;
  onUpdate(listener: () => void): () => void;
  settings: {
    get(): Promise<Result<Settings>>;
  };
}

// What the section picker can do, available to it as `window.screenshot`.
export interface ScreenshotBridge {
  image(): Promise<Result<string | null>>;
  pick(area: ScreenArea): Promise<Result>;
  cancel(): Promise<Result>;
}

// What the settings window can do, available to it as `window.piePanel`.
export interface PanelBridge {
  shortcuts: {
    list(): Promise<Result<Shortcut[]>>;
    add(item: NewShortcut): Promise<Result<Shortcut[]>>;
    update(edit: ShortcutEdit): Promise<Result<Shortcut[]>>;
    remove(id: string): Promise<Result<Shortcut[]>>;
    reorder(
      parentId: string | null,
      ids: string[],
    ): Promise<Result<Shortcut[]>>;
    move(
      id: string,
      parentId: string | null,
      index: number,
    ): Promise<Result<Shortcut[]>>;
  };
  snippets: {
    list(): Promise<Result<Snippet[]>>;
    add(item: NewSnippet): Promise<Result<Snippet[]>>;
    update(edit: SnippetEdit): Promise<Result<Snippet[]>>;
    remove(id: string): Promise<Result<Snippet[]>>;
    reorder(ids: string[]): Promise<Result<Snippet[]>>;
  };
  suggestions: {
    list(): Promise<Result<SuggestionGroup[]>>;
    change(change: SuggestionChange): Promise<Result<SuggestionGroup[]>>;
  };
  takeFormRequest(): Promise<Result<PanelFormRequest | null>>;
  onFormRequested(listener: () => void): () => void;
  settings: {
    get(): Promise<Result<Settings>>;
    update(changes: SettingsUpdate): Promise<Result<Settings>>;
  };
  allowedApps: {
    list(): Promise<Result<string[]>>;
    remove(path: string): Promise<Result<string[]>>;
  };
  pickPath(type: SliceType): Promise<Result<string | null>>;
  chrome: {
    get(): Promise<Result<ChromePairing>>;
    newCode(): Promise<Result<ChromePairing>>;
    copyCode(): Promise<Result>;
    onStatus(listener: (status: ChromeStatus) => void): () => void;
  };
}
