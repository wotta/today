export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

export interface DayEntry {
  /** ISO date "YYYY-MM-DD" — primary key. */
  date: string;
  checkItems: CheckItem[];
  /** Hour (6–26, where 24=midnight, 25=1am, 26=2am) -> free text. */
  agenda: Record<number, string>;
}

/** First and last hour shown in the agenda (Japanese-planner style 6:00 → 26:00). */
export const AGENDA_START_HOUR = 6;
export const AGENDA_END_HOUR = 26;
