import { describe, expect, it } from 'vitest';
import {
  describeReminder,
  describeTime,
  dueTime,
  firstOccurrence,
  nextOccurrence,
  quickPicks,
} from './reminder-time';

// Local times, so the tests hold in any time zone.
const local = (
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
) => new Date(year, month - 1, day, hours, minutes);

// Wednesday 11 November 2026, 10:30.
const WEDNESDAY = local(2026, 11, 11, 10, 30);

describe('quickPicks', () => {
  it('offers the Tuki choices on a weekday morning', () => {
    expect(quickPicks(WEDNESDAY)).toEqual([
      { label: 'In 1 hour', at: local(2026, 11, 11, 11, 30) },
      { label: 'Today 17:00', at: local(2026, 11, 11, 17) },
      { label: 'Tomorrow 9:00', at: local(2026, 11, 12, 9) },
      { label: 'Monday 9:00', at: local(2026, 11, 16, 9) },
    ]);
  });

  it('leaves out today 17:00 once it has passed', () => {
    const labels = quickPicks(local(2026, 11, 11, 17)).map((p) => p.label);
    expect(labels).not.toContain('Today 17:00');
  });

  it('leaves out Monday when that is tomorrow', () => {
    const labels = quickPicks(local(2026, 11, 15, 12)).map((p) => p.label);
    expect(labels).toEqual(['In 1 hour', 'Today 17:00', 'Tomorrow 9:00']);
  });

  it('picks next week on a Monday', () => {
    const monday = quickPicks(local(2026, 11, 16, 8)).find(
      (pick) => pick.label === 'Monday 9:00',
    );
    expect(monday?.at).toEqual(local(2026, 11, 23, 9));
  });
});

describe('nextOccurrence', () => {
  const anchor = local(2026, 11, 11, 9);

  it('rings a one-time reminder once', () => {
    expect(nextOccurrence(anchor, 'once', local(2026, 11, 10))).toEqual(anchor);
    expect(nextOccurrence(anchor, 'once', anchor)).toBeNull();
  });

  it('moves a daily reminder to the next day', () => {
    expect(nextOccurrence(anchor, 'daily', anchor)).toEqual(
      local(2026, 11, 12, 9),
    );
  });

  it('skips the weekend for weekdays', () => {
    // Friday 13 Nov, 9:00 rang: next is Monday.
    expect(
      nextOccurrence(
        local(2026, 11, 13, 9),
        'weekdays',
        local(2026, 11, 13, 9),
      ),
    ).toEqual(local(2026, 11, 16, 9));
  });

  it('keeps the weekday for weekly', () => {
    expect(nextOccurrence(anchor, 'weekly', local(2026, 11, 12))).toEqual(
      local(2026, 11, 18, 9),
    );
  });

  it('catches up quickly from long ago, across a month end', () => {
    expect(
      nextOccurrence(local(2025, 1, 31, 9), 'daily', local(2026, 3, 1, 10)),
    ).toEqual(local(2026, 3, 2, 9));
    expect(
      nextOccurrence(local(2025, 1, 6, 9), 'weekly', local(2026, 3, 1, 10)),
    ).toEqual(local(2026, 3, 2, 9));
  });
});

describe('firstOccurrence', () => {
  it('starts a weekday reminder set for Saturday on Monday', () => {
    expect(firstOccurrence(local(2026, 11, 14, 9), 'weekdays')).toEqual(
      local(2026, 11, 16, 9),
    );
  });

  it('keeps any other time as it is', () => {
    expect(firstOccurrence(local(2026, 11, 14, 9), 'daily')).toEqual(
      local(2026, 11, 14, 9),
    );
  });
});

describe('dueTime', () => {
  it('prefers the snooze', () => {
    expect(
      dueTime('2026-11-11T09:00:00.000Z', '2026-11-11T09:10:00.000Z'),
    ).toEqual(new Date('2026-11-11T09:10:00.000Z'));
    expect(dueTime(null, null)).toBeNull();
  });
});

describe('describing a reminder', () => {
  it('says today, tomorrow, or the date', () => {
    expect(describeTime(local(2026, 11, 11, 17), WEDNESDAY)).toBe(
      'Today 17:00',
    );
    expect(describeTime(local(2026, 11, 12, 9, 5), WEDNESDAY)).toBe(
      'Tomorrow 9:05',
    );
    expect(describeTime(local(2026, 11, 16, 9), WEDNESDAY)).toBe(
      'Mon 16 Nov 9:00',
    );
    expect(describeTime(local(2027, 1, 4, 9), WEDNESDAY)).toBe(
      'Mon 4 Jan 2027 9:00',
    );
  });

  it('adds the repeat', () => {
    expect(
      describeReminder(local(2026, 11, 12, 9), 'weekdays', WEDNESDAY),
    ).toBe('Tomorrow 9:00 · every weekday');
    expect(describeReminder(local(2026, 11, 12, 9), 'once', WEDNESDAY)).toBe(
      'Tomorrow 9:00',
    );
  });
});
