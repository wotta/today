/** Date helpers working in the user's local timezone, keyed by "YYYY-MM-DD". */

import { AGENDA_END_HOUR } from './types';

/** Hours up to here past midnight still belong to the previous day's page (26:00 -> 2am). */
const LATE_NIGHT_CUTOFF_HOUR = AGENDA_END_HOUR - 24;

/** Local-time ISO date string, e.g. "2026-06-07". Avoids the UTC shift of toISOString(). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The planner's "today". Because the agenda runs to AGENDA_END_HOUR (26:00 = 2am),
 * the early hours past midnight still belong to the previous calendar day's page —
 * e.g. at 00:30 on June 8 the active day is still June 7.
 */
export function todayKey(): string {
  const now = new Date();
  if (now.getHours() <= LATE_NIGHT_CUTOFF_HOUR) {
    now.setDate(now.getDate() - 1);
  }
  return toDateKey(now);
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

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

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
