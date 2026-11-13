import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nextOccurrence } from './reminder-time';

// Berlin moves its clocks from 02:00 to 03:00 on Sunday 29 March 2026, so
// 02:30 doesn't exist that day.
const savedZone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Berlin';
});
afterAll(() => {
  process.env.TZ = savedZone;
});

const march = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 2, day, hours, minutes);

describe('nextOccurrence across the spring clock change', () => {
  it('runs in a zone with the clock change', () => {
    expect(march(29, 2, 30).getHours()).toBe(3);
  });

  it('goes back to 02:30 the day after the change', () => {
    expect(nextOccurrence(march(28, 2, 30), 'daily', march(29, 3, 31))).toEqual(
      march(30, 2, 30),
    );
  });

  it('keeps 02:30 for weekly reminders after the change', () => {
    expect(
      nextOccurrence(march(22, 2, 30), 'weekly', march(29, 3, 31)),
    ).toEqual(new Date(2026, 3, 5, 2, 30));
  });
});
