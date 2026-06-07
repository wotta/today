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
});
export type CheckItem = z.infer<typeof CheckItemSchema>;

export const DayEntrySchema = z.object({
  /** ISO date "YYYY-MM-DD". */
  date: z.string().regex(DATE_RE),
  checkItems: z.array(CheckItemSchema),
  /** Hour (6–26, where 24=midnight, 25=1am, 26=2am) -> free text. JSON keys are strings. */
  agenda: z.record(z.string(), z.string()),
});
export type DayEntry = z.infer<typeof DayEntrySchema>;

export function emptyDay(date: string): DayEntry {
  return { date, checkItems: [], agenda: {} };
}
