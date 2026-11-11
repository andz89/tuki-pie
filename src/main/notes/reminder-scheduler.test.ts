import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DueReminder } from '../../shared/schemas/note.schema';
import { MAX_WAIT_MS, ReminderScheduler } from './reminder-scheduler';

const START = new Date('2026-11-11T10:00:00.000Z');
const card = (id: string): DueReminder => ({ id, title: id, preview: '' });

let due: DueReminder[];
let next: Date | null;
let show: ReturnType<typeof vi.fn<(due: DueReminder[]) => void>>;
let scheduler: ReminderScheduler;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  due = [];
  next = null;
  show = vi.fn();
  scheduler = new ReminderScheduler(
    { due: () => due, nextDueTime: () => next },
    show,
  );
});

afterEach(() => {
  scheduler.stop();
  vi.useRealTimers();
});

describe('ReminderScheduler', () => {
  it('shows what is due right away, including missed reminders', () => {
    due = [card('missed')];
    scheduler.refresh();
    expect(show).toHaveBeenCalledExactlyOnceWith([card('missed')]);
  });

  it('rings when the next reminder is due', () => {
    next = new Date(START.getTime() + 5 * 60 * 1000);
    scheduler.refresh();
    show.mockClear();

    due = [card('a')];
    next = null;
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    expect(show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenCalledWith([card('a')]);
  });

  it('looks again within an hour for a far reminder', () => {
    next = new Date(START.getTime() + 5 * MAX_WAIT_MS);
    scheduler.refresh();
    show.mockClear();
    vi.advanceTimersByTime(MAX_WAIT_MS);
    expect(show).toHaveBeenCalledOnce();
  });

  it('keeps ringing after the window fails to show once', () => {
    next = new Date(START.getTime() + 1000);
    show.mockImplementationOnce(() => {
      throw new Error('window gone');
    });
    expect(() => scheduler.refresh()).not.toThrow();

    due = [card('a')];
    next = null;
    vi.advanceTimersByTime(1000);
    expect(show).toHaveBeenLastCalledWith([card('a')]);
  });

  it('looks again within an hour when reading the reminders fails', () => {
    const failing = new ReminderScheduler(
      {
        due: () => {
          throw new Error('database is locked');
        },
        nextDueTime: () => next,
      },
      show,
    );
    expect(() => failing.refresh()).not.toThrow();
    expect(vi.getTimerCount()).toBe(1);
    failing.stop();
  });

  it('keeps one timer when refreshed again', () => {
    next = new Date(START.getTime() + 1000);
    scheduler.refresh();
    scheduler.refresh();
    show.mockClear();
    vi.advanceTimersByTime(1000);
    expect(show).toHaveBeenCalledOnce();
  });

  it('sets no timer without reminders, and stops', () => {
    scheduler.refresh();
    expect(vi.getTimerCount()).toBe(0);
    next = new Date(START.getTime() + 1000);
    scheduler.refresh();
    scheduler.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
