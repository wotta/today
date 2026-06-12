/** Pure logic for slot reminders: which agenda slot is about to start, and
 * which checklist items it should notify about. The background script owns
 * the alarms/notifications plumbing; keeping this separate makes it testable. */

import type { CheckItem, DayEntry } from './types';
import { AGENDA_END_HOUR, AGENDA_START_HOUR } from './types';
import { toDateKey } from './date';

/** How long before a slot starts the notification fires. */
export const REMINDER_LEAD_MINUTES = 10;

export interface SlotReminder {
  /** Planner date key the slot belongs to (late-night slots -> previous day). */
  dateKey: string;
  /** Agenda hour (6–26). */
  slot: number;
  /** Whole minutes until the slot starts (1–REMINDER_LEAD_MINUTES). */
  minutesUntil: number;
}

/**
 * The agenda slot starting within the next REMINDER_LEAD_MINUTES, or null.
 * Late-night hours map planner-style: a slot starting at 0:00/1:00/2:00 is
 * 24/25/26 on the previous calendar day's page. Slots starting at 3:00–5:00
 * don't exist (the agenda runs 6:00 → 26:00).
 */
export function upcomingSlot(now: Date): SlotReminder | null {
  const boundary = new Date(now);
  boundary.setHours(boundary.getHours() + 1, 0, 0, 0);
  const minutesUntil = Math.ceil((boundary.getTime() - now.getTime()) / 60_000);
  if (minutesUntil > REMINDER_LEAD_MINUTES) return null;

  const hour = boundary.getHours();
  if (hour >= AGENDA_START_HOUR && hour <= 23) {
    return { dateKey: toDateKey(boundary), slot: hour, minutesUntil };
  }
  const lateSlot = hour + 24;
  if (lateSlot <= AGENDA_END_HOUR) {
    const previousDay = new Date(boundary);
    previousDay.setDate(previousDay.getDate() - 1);
    return { dateKey: toDateKey(previousDay), slot: lateSlot, minutesUntil };
  }
  return null;
}

/** Items worth reminding about: pinned to the slot and not yet done. */
export function itemsDueForSlot(entry: DayEntry, slot: number): CheckItem[] {
  return entry.checkItems.filter((item) => item.slot === slot && !item.done);
}

/** Dedup key so a slot is only notified once even if the alarm re-fires. */
export function reminderKey(reminder: SlotReminder): string {
  return `${reminder.dateKey}:${reminder.slot}`;
}
