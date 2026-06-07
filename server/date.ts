import { AGENDA_END_HOUR } from './types';

/**
 * Hours up to here past midnight still belong to the previous day's page
 * (26:00 -> 2am). Kept in sync with the extension's lib/date.ts.
 */
const LATE_NIGHT_CUTOFF_HOUR = AGENDA_END_HOUR - 24;

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The planner's "today" in local time. Because the agenda runs to 26:00 (2am),
 * the early hours past midnight still belong to the previous calendar day's page.
 * Must match the extension so both agree on which day "today" is.
 */
export function todayKey(): string {
  const now = new Date();
  if (now.getHours() <= LATE_NIGHT_CUTOFF_HOUR) {
    now.setDate(now.getDate() - 1);
  }
  return toDateKey(now);
}
