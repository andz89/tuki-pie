import { z } from 'zod';
import {
  MAX_MESSAGE_BYTES,
  sameAddress,
} from '../../../packages/pie-extension/protocol.js';
import { LINK_SPOTS } from '../../shared/types';
import type { CaptureSize, LinkSpot, PageInfoUpdate } from '../../shared/types';
import { UserError } from '../services/user-error';
import { buildPageReport } from './page-report';
import { enteredAddress } from './site-address';

const SETTLE_MS = 1500;
// Chrome runs a tab you can't see more slowly, so late tags need longer.
const LATE_READ_MS = 5000;
// A single-page site can change its address several times in a row (a
// redirect, then a tab, then a scroll position). Only the last one is read.
const IN_PLACE_WAIT_MS = 500;
const LOAD_LIMIT_MS = 30000;
const READ_LIMIT_MS = 5000;
// Chromium's code for a load replaced by a newer one, which isn't a failure.
export const ERROR_ABORTED = -3;

const BAD_ADDRESS = 'Enter a web address, like example.com.';
const COULD_NOT_OPEN = 'Could not open that page.';
const COULD_NOT_READ = 'Could not read that page.';
const TOO_SLOW = 'That page took too long.';
const CHROME_OFF = 'Chrome not connected.';
const TAB_CLOSED = 'The Chrome tab was closed.';
const NOTHING_TO_CAPTURE = 'Check a page first.';
const PAGE_CHANGED = 'The page changed while taking the screenshot. Try again.';

const CAPTURE_PROBLEMS: Record<string, string> = {
  'devtools-open': 'Close DevTools (F12) on this tab, then try again.',
  'other-extension':
    'Another extension is controlling this tab. Wait until it finishes, then try again.',
  'not-allowed': "Chrome doesn't allow capturing this page.",
  'no-device':
    "Chrome didn't allow showing this page as a device. Close DevTools (F12) on this tab, or choose Desktop.",
  'not-drawn':
    'Chrome is hidden behind other windows, so it stopped drawing the page. Bring Chrome to the front, then try again.',
  timeout:
    'The page took too long to capture. Try again once it has finished loading.',
};
// The section's problems name the selector the user typed.
const SECTION_PROBLEMS: Record<string, (section: string) => string> = {
  'no-section': (section) => `Nothing on the page matches ${section}.`,
  'bad-selector': () =>
    "That isn't a CSS selector. Use .class, #id or another selector.",
  'empty-section': (section) =>
    `The element matching ${section} isn't shown on the page.`,
};
const COULD_NOT_CAPTURE = 'Could not take the screenshot.';

const Captured = z.object({
  dataUrl: z
    .string()
    .startsWith('data:image/jpeg;base64,')
    .max(MAX_MESSAGE_BYTES),
  method: z.enum(['debugger', 'stitched']),
  // Why the debugger didn't work, in Chrome's words.
  reason: z.string().max(500).nullish(),
  // How many elements matched the section's selector.
  matches: z.number().int().min(1).nullish(),
});
const CaptureFailed = z.object({ error: z.string() });

// A picture of the checked page, or of one section, as the extension took it.
export interface PageCapture {
  dataUrl: string;
  stitched: boolean;
  stitchReason: string | null;
  device: string;
  section: string;
  matches: number | null;
}

// The Chrome tab every check runs in.
export interface PageSite {
  load(url: string): void;
  reload(): void;
  stop(): void;
  read(): Promise<unknown>;
  goToTab(): void;
  showLink(index: number, href: string): Promise<unknown>;
  openTabs(urls: string[]): void;
  capture(size: CaptureSize): Promise<unknown>;
}

// The browser window inside the app. It only shows the page, it never reads it.
export interface SiteViewer {
  show(url: string): void;
  hide(): void;
}

export class PageInfoController {
  private update: PageInfoUpdate = {
    status: 'idle',
    address: null,
    report: null,
    message: null,
    siteVisible: false,
    chromeConnected: false,
    reportId: 0,
  };
  private isDisposed = false;
  private isPageLoading = false;
  private hasCommitted = false;
  // A stopped page, and the browser's own error page, still report as loaded.
  private ignoresLoadFinish = false;
  // Only the newest read may change the window. Older ones find this has moved.
  private latestRead = 0;
  private loadTimer: ReturnType<typeof setTimeout> | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private lateReadTimer: ReturnType<typeof setTimeout> | undefined;
  private inPlaceTimer: ReturnType<typeof setTimeout> | undefined;
  // The address before an in-place change, until a read shows where it went.
  private addressBeforeInPlace: string | null = null;
  private checksStarted = 0;
  // Changes with every page, so a screenshot never outlives the page it shows.
  private pageCount = 0;
  private captured: PageCapture | null = null;

  constructor(
    private readonly site: PageSite,
    private readonly viewer: SiteViewer,
    private readonly send: (update: PageInfoUpdate) => void,
  ) {}

  state(): PageInfoUpdate {
    return this.update;
  }

  // Changes whenever a check starts, so a slow automatic check can tell that
  // you started your own in the meantime.
  checkCount(): number {
    return this.checksStarted;
  }

  check(value: string): void {
    const address = enteredAddress(value);
    if (address === null) {
      throw new UserError(BAD_ADDRESS);
    }
    if (!this.update.chromeConnected) {
      throw new UserError(CHROME_OFF);
    }
    this.checksStarted += 1;
    this.startPage(address);
    this.site.load(address);
    // An open viewer follows along, so it shows what is being checked.
    if (this.update.siteVisible) {
      this.viewer.show(address);
    }
  }

  refresh(): void {
    if (this.update.address === null) {
      return;
    }
    if (!this.update.chromeConnected) {
      this.endPage({ message: CHROME_OFF });
      return;
    }
    const address = this.update.address;
    const canReload = this.hasCommitted;
    this.startPage(address);
    if (canReload) {
      this.site.reload();
    } else {
      this.site.load(address);
    }
  }

  setSiteVisible(visible: boolean): void {
    const address = this.update.address;
    if (visible && address === null) {
      return;
    }
    if (visible && address !== null) {
      this.viewer.show(address);
    } else {
      this.viewer.hide();
    }
    this.apply({ siteVisible: visible });
  }

  // Says whether it went, so the window knows to make way for Chrome.
  goToTab(): boolean {
    if (this.update.address === null || !this.update.chromeConnected) {
      return false;
    }
    this.site.goToTab();
    return true;
  }

  // Null when there is no checked page, or Chrome didn't answer.
  async showLink(index: number, href: string): Promise<LinkSpot | null> {
    if (this.update.address === null || !this.update.chromeConnected) {
      return null;
    }
    const spot = await this.site.showLink(index, href).catch(() => null);
    return LINK_SPOTS.includes(spot as LinkSpot) ? (spot as LinkSpot) : null;
  }

  openLinks(urls: string[]): boolean {
    if (!this.update.chromeConnected || urls.length === 0) {
      return false;
    }
    this.site.openTabs(urls);
    return true;
  }

  // Kept until the page changes, so it can be saved or copied.
  async capture(size: CaptureSize): Promise<PageCapture> {
    if (this.update.report === null || !this.update.chromeConnected) {
      throw new UserError(
        this.update.chromeConnected ? NOTHING_TO_CAPTURE : CHROME_OFF,
      );
    }
    const page = this.pageCount;
    const section = size.section.trim();
    const raw = await this.site.capture({ ...size, section }).catch(() => null);
    if (this.isDisposed || page !== this.pageCount) {
      throw new UserError(PAGE_CHANGED);
    }
    const shot = Captured.safeParse(raw);
    if (!shot.success) {
      const failed = CaptureFailed.safeParse(raw);
      const error = failed.success ? failed.data.error : '';
      throw new UserError(
        SECTION_PROBLEMS[error]?.(section) ??
          (CAPTURE_PROBLEMS[error] || COULD_NOT_CAPTURE),
      );
    }
    this.captured = {
      dataUrl: shot.data.dataUrl,
      stitched: shot.data.method === 'stitched',
      stitchReason: shot.data.reason ?? null,
      device: size.device,
      section,
      matches: section ? (shot.data.matches ?? null) : null,
    };
    return this.captured;
  }

  capturedImage(): PageCapture | null {
    return this.captured;
  }

  // A check in Chrome can't go on without it, so it ends like a failed page.
  setChromeConnected(connected: boolean): void {
    if (connected === this.update.chromeConnected) {
      return;
    }
    // Back again: the message saying it was gone is no longer true.
    const message =
      connected && this.update.message === CHROME_OFF
        ? null
        : this.update.message;
    this.apply({ chromeConnected: connected, message });
    if (!connected && this.update.address !== null) {
      this.endPage({ message: CHROME_OFF });
    }
  }

  // The viewer's X, or the page in it closing itself.
  siteHidden(): void {
    this.apply({ siteVisible: false });
  }

  // A new page has really arrived in the tab. Anything less, like a click on a
  // mailto: link, never gets here, so the cards stay as they are.
  sitePageCommitted(): void {
    if (!this.isPageLoading) {
      this.startPage(this.update.address);
    }
    this.hasCommitted = true;
  }

  siteLoaded(): void {
    // Without a commit, this is the previous page finishing late.
    if (this.ignoresLoadFinish || (this.isPageLoading && !this.hasCommitted)) {
      return;
    }
    this.stopTimers();
    this.isPageLoading = false;
    this.readSoonAndLater();
  }

  sitePageChangedInPlace(): void {
    if (this.isPageLoading) {
      return;
    }
    clearTimeout(this.settleTimer);
    clearTimeout(this.lateReadTimer);
    clearTimeout(this.inPlaceTimer);
    this.addressBeforeInPlace ??= this.update.address;
    // The site updates its title and details just after changing the address.
    this.inPlaceTimer = setTimeout(
      () => this.readSoonAndLater(),
      IN_PLACE_WAIT_MS,
    );
  }

  // A load that stopped by itself and wasn't replaced by a newer one.
  siteCancelled(): void {
    if (this.isPageLoading) {
      this.endPage({});
    }
  }

  siteFailed(errorCode: number): void {
    if (errorCode !== ERROR_ABORTED) {
      this.endPage({});
    }
  }

  // You closed the Chrome tab.
  siteClosed(): void {
    this.endPage({ message: TAB_CLOSED });
  }

  dispose(): void {
    this.isDisposed = true;
    this.stopTimers();
    this.latestRead += 1;
  }

  private startPage(address: string | null): void {
    this.stopTimers();
    this.forgetCapture();
    this.addressBeforeInPlace = null;
    this.latestRead += 1;
    this.isPageLoading = true;
    this.hasCommitted = false;
    this.ignoresLoadFinish = false;
    this.apply({
      status: 'checking',
      address,
      report: null,
      message: null,
      reportId: this.update.reportId + 1,
    });
    this.loadTimer = setTimeout(() => this.giveUpWaiting(), LOAD_LIMIT_MS);
  }

  // A page can't be read while it is still loading, so it has to be stopped.
  // If it never arrived, the window still holds the previous page.
  private giveUpWaiting(): void {
    if (!this.hasCommitted) {
      this.site.stop();
      this.endPage({ message: TOO_SLOW });
      return;
    }
    this.isPageLoading = false;
    this.ignoresLoadFinish = true;
    this.site.stop();
    void this.read(TOO_SLOW);
  }

  private endPage(changes: Partial<PageInfoUpdate>): void {
    this.stopTimers();
    this.forgetCapture();
    this.addressBeforeInPlace = null;
    this.isPageLoading = false;
    this.hasCommitted = false;
    this.ignoresLoadFinish = true;
    this.latestRead += 1;
    this.apply({
      status: 'failed',
      report: null,
      message: COULD_NOT_OPEN,
      reportId: this.update.reportId + 1,
      ...changes,
    });
  }

  private forgetCapture(): void {
    this.pageCount += 1;
    this.captured = null;
  }

  // Tags often load late, so the page is read again a little later.
  private readSoonAndLater(): void {
    void this.read();
    this.settleTimer = setTimeout(() => void this.read(), SETTLE_MS);
    this.lateReadTimer = setTimeout(() => void this.read(), LATE_READ_MS);
  }

  private stopTimers(): void {
    clearTimeout(this.loadTimer);
    clearTimeout(this.settleTimer);
    clearTimeout(this.lateReadTimer);
    clearTimeout(this.inPlaceTimer);
  }

  // After an in-place change: a new path or query is a new page, so the
  // screenshot and your ticks go. A new # part only moved within the page.
  private settleInPlaceChange(url: string): number {
    const before = this.addressBeforeInPlace;
    this.addressBeforeInPlace = null;
    if (before === null || sameAddress(before, url)) {
      return this.update.reportId;
    }
    this.forgetCapture();
    return this.update.reportId + 1;
  }

  private async read(warning: string | null = null): Promise<void> {
    this.latestRead += 1;
    const thisRead = this.latestRead;
    const raw = await Promise.race([
      this.site.read().catch(() => null),
      new Promise((resolve) => setTimeout(resolve, READ_LIMIT_MS, null)),
    ]);
    if (this.isDisposed || thisRead !== this.latestRead) {
      return;
    }

    const report = buildPageReport(raw);
    if (report !== null) {
      this.apply({
        status: warning === null ? 'done' : 'failed',
        address: report.url,
        report,
        message: warning,
        reportId: this.settleInPlaceChange(report.url),
      });
    } else if (warning !== null || this.update.report === null) {
      this.apply({ status: 'failed', message: warning ?? COULD_NOT_READ });
    }
    // Otherwise only a later re-read failed, so the first report still stands.
  }

  // Each page is read three times, and most reads find nothing new. Sending
  // only real changes spares the window a redraw of every list.
  private apply(changes: Partial<PageInfoUpdate>): void {
    const next = { ...this.update, ...changes };
    const isSame = JSON.stringify(next) === JSON.stringify(this.update);
    this.update = next;
    if (!this.isDisposed && !isSame) {
      this.send(this.update);
    }
  }
}
