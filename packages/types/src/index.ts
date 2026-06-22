export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
  order: number;
  /** Optional long-form detail shown in the item's view/edit modal. */
  description?: string;
  /** Optional agenda slot (6–26) this item is pinned to, in 0.25-hour steps
   *  (e.g. 14.5 = 14:30, 14.25 = 14:15). Whole numbers are on-the-hour.
   *  Absent = unpinned. */
  slot?: number;
}

/** dataTransfer MIME used to drag a checklist item onto an agenda hour. */
export const ITEM_DRAG_MIME = 'application/x-today-item';

export interface DayEntry {
  /** ISO date "YYYY-MM-DD" — primary key. */
  date: string;
  checkItems: CheckItem[];
  /** Hour (6–26, where 24=midnight, 25=1am, 26=2am) -> free text. */
  agenda: Record<number, string>;
  /** Freeform markdown note for the whole day. */
  note?: string;
  /** Hour (6–26) -> markdown note, keyed like agenda. */
  slotNotes?: Record<number, string>;
}

/** First and last hour shown in the agenda (Japanese-planner style 6:00 → 26:00). */
export const AGENDA_START_HOUR = 6;
export const AGENDA_END_HOUR = 26;
