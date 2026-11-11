import type { DueReminder } from '../../shared/schemas/note.schema';

// Looks again at least this often, so a computer waking from sleep, or a
// clock that changed, still rings close to on time.
export const MAX_WAIT_MS = 60 * 60 * 1000;

interface ReminderSource {
  due(): DueReminder[];
  nextDueTime(): Date | null;
}

interface Timers {
  set: (run: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear: (timer: ReturnType<typeof setTimeout>) => void;
}

const REAL_TIMERS: Timers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (timer) => clearTimeout(timer),
};

// Shows the reminders that are due, and sets one timer for the next one.
export class ReminderScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly source: ReminderSource,
    private readonly show: (due: DueReminder[]) => void,
    private readonly now: () => number = () => Date.now(),
    private readonly timers: Timers = REAL_TIMERS,
  ) {}

  // Also on start, so reminders missed while the app was closed show now.
  // A failure here must not stop every later reminder. After any failure
  // the timer is set again, within the hour at the latest.
  refresh(): void {
    this.stop();
    let failed = false;
    try {
      this.show(this.source.due());
    } catch (error) {
      failed = true;
      console.warn('Reminders could not be shown:', error);
    }
    let wait: number | null = MAX_WAIT_MS;
    try {
      wait = this.waitForNext();
    } catch (error) {
      failed = true;
      console.warn('The next reminder could not be read:', error);
    }
    if (wait === null && failed) {
      wait = MAX_WAIT_MS;
    }
    if (wait !== null) {
      this.timer = this.timers.set(() => this.refresh(), wait);
    }
  }

  private waitForNext(): number | null {
    const next = this.source.nextDueTime();
    if (next === null) {
      return null;
    }
    return Math.min(Math.max(next.getTime() - this.now(), 0), MAX_WAIT_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      this.timers.clear(this.timer);
      this.timer = null;
    }
  }
}
