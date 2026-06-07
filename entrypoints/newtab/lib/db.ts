import Dexie, { type EntityTable } from 'dexie';
import type { DayEntry } from './types';

/** One IndexedDB table: a single DayEntry per calendar date, keyed by "YYYY-MM-DD". */
const db = new Dexie('today') as Dexie & {
  days: EntityTable<DayEntry, 'date'>;
};

db.version(1).stores({
  // Only the primary key needs an index; the rest of the entry is a blob.
  days: 'date',
});

export { db };

/** A fresh, empty entry for a date — not persisted until the user touches it. */
export function emptyDay(date: string): DayEntry {
  return { date, checkItems: [], agenda: {} };
}

/**
 * Load the entry for a date, or return an in-memory empty one if none exists.
 * We deliberately do NOT write empty days here — see saveDay for lazy creation.
 */
export async function getDay(date: string): Promise<DayEntry> {
  const existing = await db.days.get(date);
  return existing ?? emptyDay(date);
}

/** True once a day has any content worth persisting. */
function hasContent(entry: DayEntry): boolean {
  if (entry.checkItems.length > 0) return true;
  return Object.values(entry.agenda).some((text) => text.trim() !== '');
}

/**
 * Persist a day. Lazy: empty days are removed rather than stored, so browsing
 * across many dates never bloats the DB with blank records.
 */
export async function saveDay(entry: DayEntry): Promise<void> {
  if (hasContent(entry)) {
    await db.days.put(entry);
  } else {
    await db.days.delete(entry.date);
  }
}
