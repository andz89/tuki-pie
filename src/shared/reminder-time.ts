// When note reminders are due, in the computer's local time. Pure, so the
// main process and the Notes window agree, and tests can fix "now".

export const REPEATS = ['once', 'daily', 'weekdays', 'weekly'] as const;
export type Repeat = (typeof REPEATS)[number];

export const REPEAT_LABELS: Record<Repeat, string> = {
  once: 'Once',
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
};

export const SNOOZE_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MONDAY = 1;
const SATURDAY = 6;
const SUNDAY = 0;
// Enough steps to cross any weekend, whatever the clock change.
const MAX_STEPS = 14;

export interface QuickPick {
  label: string;
  at: Date;
}

function atTime(day: Date, hours: number, minutes = 0): Date {
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function addDays(day: Date, days: number): Date {
  // setDate keeps the wall-clock time across a clock change.
  const result = new Date(day);
  result.setDate(result.getDate() + days);
  return result;
}

const isWeekday = (day: Date) =>
  day.getDay() !== SATURDAY && day.getDay() !== SUNDAY;

// The quick choices under "Remind me", as in Tuki.
export function quickPicks(now: Date): QuickPick[] {
  const inAnHour = new Date(now.getTime() + HOUR_MS);
  inAnHour.setSeconds(0, 0);
  const picks: QuickPick[] = [{ label: 'In 1 hour', at: inAnHour }];

  const todayFive = atTime(now, 17);
  if (now < todayFive) {
    picks.push({ label: 'Today 17:00', at: todayFive });
  }
  const tomorrow = addDays(now, 1);
  picks.push({ label: 'Tomorrow 9:00', at: atTime(tomorrow, 9) });

  // The next Monday after today. Left out when that is tomorrow.
  const daysToMonday = (MONDAY - now.getDay() + 7) % 7 || 7;
  if (daysToMonday > 1) {
    picks.push({
      label: 'Monday 9:00',
      at: atTime(addDays(now, daysToMonday), 9),
    });
  }
  return picks;
}

// The first time the reminder rings after `after`, or null when a one-time
// reminder is over. Repeats keep the anchor's time of day.
export function nextOccurrence(
  anchor: Date,
  repeat: Repeat,
  after: Date,
): Date | null {
  if (repeat === 'once') {
    return anchor > after ? anchor : null;
  }
  const step = repeat === 'weekly' ? 7 : 1;
  // Jump close to `after` first, so a reminder set long ago is still quick.
  const behind = Math.floor((after.getTime() - anchor.getTime()) / DAY_MS);
  const jumps = behind > step ? Math.floor((behind - 1) / step) : 0;
  let candidate = addDays(anchor, jumps * step);

  for (let tries = 0; tries < MAX_STEPS + 7; tries += 1) {
    const fits = repeat !== 'weekdays' || isWeekday(candidate);
    if (candidate > after && fits) {
      return candidate;
    }
    candidate = addDays(candidate, step);
  }
  return null;
}

// The reminder's own first time: a weekday reminder set for a Saturday
// starts on Monday.
export function firstOccurrence(at: Date, repeat: Repeat): Date {
  return nextOccurrence(at, repeat, new Date(at.getTime() - 1)) ?? at;
}

// A snooze rings instead of the reminder's own time until it is over.
export function dueTime(
  remindAt: string | null,
  snoozedUntil: string | null,
): Date | null {
  const time = snoozedUntil ?? remindAt;
  return time === null ? null : new Date(time);
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const clock = (time: Date) =>
  `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// "Today 17:00", "Tomorrow 9:00", "Mon 17 Nov 9:00", with the year when it
// isn't this year.
export function describeTime(time: Date, now: Date): string {
  if (sameDay(time, now)) {
    return `Today ${clock(time)}`;
  }
  if (sameDay(time, addDays(now, 1))) {
    return `Tomorrow ${clock(time)}`;
  }
  const year =
    time.getFullYear() === now.getFullYear() ? '' : ` ${time.getFullYear()}`;
  return `${DAYS[time.getDay()]} ${time.getDate()} ${MONTHS[time.getMonth()]}${year} ${clock(time)}`;
}

// "Tomorrow 9:00 · every weekday".
export function describeReminder(
  time: Date,
  repeat: Repeat,
  now: Date,
): string {
  const when = describeTime(time, now);
  return repeat === 'once'
    ? when
    : `${when} · ${REPEAT_LABELS[repeat].toLowerCase()}`;
}
