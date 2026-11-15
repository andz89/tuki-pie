// A saved time as a short date, or with the year and time.
export function savedDate(iso: string, withTime = false): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: withTime ? 'numeric' : undefined,
    hour: withTime ? 'numeric' : undefined,
    minute: withTime ? '2-digit' : undefined,
  }).format(new Date(iso));
}
