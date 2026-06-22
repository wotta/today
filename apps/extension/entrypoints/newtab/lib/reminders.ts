/** Pure logic for slot reminders: which agenda slot is about to start, and
 * which checklist items it should notify about. The background script owns
 * the alarms/notifications plumbing; keeping this separate makes it testable. */

import type { CheckItem, DayEntry } from '@today/types';
import { AGENDA_END_HOUR, AGENDA_START_HOUR } from '@today/types';
import { toDateKey } from './date';

/** How long before a slot starts the notification fires. */
export const REMINDER_LEAD_MINUTES = 10;

/**
 * Finest agenda granularity (minutes). Reminders scan this grid so a slot at
 * :15/:30/:45 still fires, regardless of the user's chosen display granularity.
 * Must stay ≤ REMINDER_LEAD_MINUTES so the per-minute alarm catches every
 * boundary inside the lead window.
 */
const SLOT_STEP_MINUTES = 15;

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
 * Boundaries fall on the SLOT_STEP_MINUTES grid (:00/:15/:30/:45), so a slot
 * pinned to 14:30 fires ~10 min before, not on the hour. Late-night hours map
 * planner-style: a slot starting at 0:xx/1:xx/2:xx is 24/25/26 on the previous
 * calendar day's page. Slots starting at 3:00–5:00 don't exist (agenda runs
 * 6:00 → 26:00).
 */
export function upcomingSlot(now: Date): SlotReminder | null {
  // Next grid boundary strictly after `now` (zeroing seconds first so an exact
  // boundary like 14:30:00 advances to 14:45, treating "now" as not upcoming).
  const boundary = new Date(now);
  boundary.setSeconds(0, 0);
  const step = Math.floor(boundary.getMinutes() / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
  boundary.setMinutes(step + SLOT_STEP_MINUTES); // overflow rolls into the next hour
  const minutesUntil = Math.ceil((boundary.getTime() - now.getTime()) / 60_000);
  if (minutesUntil > REMINDER_LEAD_MINUTES) return null;

  const hour = boundary.getHours();
  const frac = boundary.getMinutes() / 60; // 0, 0.25, 0.5, 0.75
  if (hour >= AGENDA_START_HOUR && hour <= 23) {
    return { dateKey: toDateKey(boundary), slot: hour + frac, minutesUntil };
  }
  const lateSlot = hour + 24;
  if (lateSlot <= AGENDA_END_HOUR) {
    const previousDay = new Date(boundary);
    previousDay.setDate(previousDay.getDate() - 1);
    return { dateKey: toDateKey(previousDay), slot: lateSlot + frac, minutesUntil };
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
