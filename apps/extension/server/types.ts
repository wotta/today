import { z } from 'zod';

/** First and last hour shown in the agenda (Japanese-planner style 6:00 → 26:00). */
export const AGENDA_START_HOUR = 6;
export const AGENDA_END_HOUR = 26;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const CheckItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
  order: z.number(),
  /** Optional long-form detail shown in the item's view/edit modal. */
  description: z.string().optional(),
  /** Optional agenda slot (6–26) this item is pinned to, in 0.25-hour steps
   *  (e.g. 14.5 = 14:30, 14.25 = 14:15). Whole numbers are on-the-hour.
   *  Absent = unpinned. */
  slot: z.number().multipleOf(0.25).min(AGENDA_START_HOUR).max(AGENDA_END_HOUR).optional(),
});
export type CheckItem = z.infer<typeof CheckItemSchema>;

export const DayEntrySchema = z.object({
  /** ISO date "YYYY-MM-DD". */
  date: z.string().regex(DATE_RE),
  checkItems: z.array(CheckItemSchema),
  /** Hour (6–26, where 24=midnight, 25=1am, 26=2am) -> free text. JSON keys are strings. */
  agenda: z.record(z.string(), z.string()),
  /** Freeform markdown note for the whole day. */
  note: z.string().optional(),
  /** Hour (6–26) -> markdown note. JSON keys are strings, like agenda. */
  slotNotes: z.record(z.string(), z.string()).optional(),
});
export type DayEntry = z.infer<typeof DayEntrySchema>;

export function emptyDay(date: string): DayEntry {
  return { date, checkItems: [], agenda: {} };
}
