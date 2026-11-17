import type { FrontApp } from './front-app';

// How often to look at which app is in front. Windows has no cheap "app in
// front changed" signal for us, and this check is two quick calls.
export const LOOK_MS = 200;

interface Deps {
  frontApp: () => FrontApp;
  show: () => void;
  hide: () => void;
}

// The card shows only while Chrome is in front. Another app in front, Chrome
// minimized or closed: the card hides, and comes back with Chrome. Pie
// Launcher itself in front (the card, the pie, Web Page) leaves it as it is.
// A change counts once it is seen twice in a row, so the moment of an
// Alt+Tab does not make the card blink.
export class InfoCardVisibility {
  private timer: ReturnType<typeof setInterval> | undefined;
  private last: FrontApp = null;

  constructor(private readonly deps: Deps) {}

  start(): void {
    this.stop();
    this.timer = setInterval(() => this.look(), LOOK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private look(): void {
    const front = this.deps.frontApp();
    const settled = front === this.last;
    this.last = front;
    if (!settled) {
      return;
    }
    if (front === 'chrome') {
      this.deps.show();
    } else if (front === 'other') {
      this.deps.hide();
    }
  }
}
