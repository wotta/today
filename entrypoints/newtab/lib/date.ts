/** Date helpers working in the user's local timezone, keyed by "YYYY-MM-DD". */

/** Local-time ISO date string, e.g. "2026-06-07". Avoids the UTC shift of toISOString(). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Parse a "YYYY-MM-DD" key into a local-midnight Date. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Shift a date key by a number of days (negative = past). */
export function addDays(key: string, delta: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

/** 0 (Sunday) … 6 (Saturday). */
export function dayOfWeek(key: string): number {
  return fromDateKey(key).getDay();
}

export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** e.g. "June 7, 2026". */
export function formatLongDate(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Agenda hour label, preserving the Japanese-planner notation: hours past
 * midnight stay 24:00 / 25:00 / 26:00 rather than wrapping to 0:00 / 2:00.
 */
export function hourLabel(hour: number): string {
  return `${hour}:00`;
}

/** True if the agenda hour falls past midnight (24, 25, 26 -> next-day early hours). */
export function isLateNight(hour: number): boolean {
  return hour >= 24;
}
