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
  if (Object.values(entry.agenda).some((text) => text.trim() !== '')) return true;
  if (entry.note && entry.note.trim() !== '') return true;
  return Object.values(entry.slotNotes ?? {}).some((text) => text.trim() !== '');
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

export interface ExportEnvelope {
  version: 1;
  exportedAt: string;
  days: Record<string, DayEntry>;
}

/**
 * Download all days as a JSON envelope. Pass the authoritative `days` map when
 * the backend is reachable; without it this falls back to the IndexedDB cache,
 * which only holds days this browser has visited.
 */
export async function exportAll(days?: Record<string, DayEntry>): Promise<void> {
  if (!days) {
    const all = await db.days.toArray();
    days = {};
    for (const entry of all) {
      days[entry.date] = entry;
    }
  }
  const envelope: ExportEnvelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    days,
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `today-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDays(
  file: File,
  serverPut?: (entry: DayEntry) => Promise<void>,
): Promise<{ imported: number; skipped: number }> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid file');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as ExportEnvelope).version !== 1 ||
    typeof (parsed as ExportEnvelope).days !== 'object'
  ) {
    throw new Error('Unrecognised format');
  }

  const { days } = parsed as ExportEnvelope;
  let imported = 0;
  let skipped = 0;

  for (const [date, entry] of Object.entries(days)) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof entry.date !== 'string' ||
      !Array.isArray(entry.checkItems) ||
      typeof entry.agenda !== 'object'
    ) {
      skipped++;
      continue;
    }
    const existing = await db.days.get(date);
    if (existing) {
      skipped++;
      continue;
    }
    await db.days.put(entry as DayEntry);
    if (serverPut) {
      try {
        await serverPut(entry as DayEntry);
      } catch {
        // Server push is best-effort; data is safe in IndexedDB.
      }
    }
    imported++;
  }

  return { imported, skipped };
}
