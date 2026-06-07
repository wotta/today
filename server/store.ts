import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import {
  AGENDA_END_HOUR,
  AGENDA_START_HOUR,
  type CheckItem,
  type DayEntry,
  emptyDay,
} from './types';

export const DATA_PATH = process.env.TODAY_DATA
  ? path.resolve(process.env.TODAY_DATA)
  : path.join(os.homedir(), '.today', 'data.json');

interface DB {
  days: Record<string, DayEntry>;
}

/** Emitted whenever a day changes. `origin` is the writing client id (null for MCP edits). */
export interface ChangeEvent {
  date: string;
  origin: string | null;
}

class Store extends EventEmitter {
  private db: DB = { days: {} };
  private writeChain: Promise<void> = Promise.resolve();

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(DATA_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DB>;
      this.db = { days: parsed.days ?? {} };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('today: could not read data file, starting empty:', err);
      }
      this.db = { days: {} };
    }
  }

  private hasContent(e: DayEntry): boolean {
    if (e.checkItems.length > 0) return true;
    return Object.values(e.agenda).some((t) => t.trim() !== '');
  }

  /** Atomic write (temp file + rename), serialized so concurrent edits can't interleave. */
  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.db, null, 2);
    this.writeChain = this.writeChain
      .then(async () => {
        await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
        const tmp = `${DATA_PATH}.${randomUUID()}.tmp`;
        await fs.writeFile(tmp, snapshot, 'utf8');
        await fs.rename(tmp, DATA_PATH);
      })
      .catch((err) => console.error('today: failed to write data file:', err));
    return this.writeChain;
  }

  getDay(date: string): DayEntry {
    return this.db.days[date] ?? emptyDay(date);
  }

  listDays(): Array<{ date: string; checkItems: number; agendaEntries: number }> {
    return Object.values(this.db.days)
      .filter((e) => this.hasContent(e))
      .map((e) => ({
        date: e.date,
        checkItems: e.checkItems.length,
        agendaEntries: Object.values(e.agenda).filter((t) => t.trim() !== '').length,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  /** Store (or, if empty, drop) a day, persist, and notify listeners. */
  private async commit(entry: DayEntry, origin: string | null): Promise<DayEntry> {
    if (this.hasContent(entry)) {
      this.db.days[entry.date] = entry;
    } else {
      delete this.db.days[entry.date];
    }
    await this.persist();
    this.emit('change', { date: entry.date, origin } satisfies ChangeEvent);
    return entry;
  }

  putDay(entry: DayEntry, origin: string | null): Promise<DayEntry> {
    return this.commit(entry, origin);
  }

  private sortedItems(day: DayEntry): CheckItem[] {
    return [...day.checkItems].sort((a, b) => a.order - b.order);
  }

  async addCheckItem(date: string, text: string): Promise<CheckItem> {
    const day = structuredClone(this.getDay(date));
    const order = day.checkItems.reduce((max, it) => Math.max(max, it.order), -1) + 1;
    const item: CheckItem = { id: randomUUID(), text, done: false, order };
    day.checkItems.push(item);
    await this.commit(day, null);
    return item;
  }

  async updateCheckItem(
    date: string,
    id: string,
    patch: { text?: string; done?: boolean },
  ): Promise<CheckItem | null> {
    const day = structuredClone(this.getDay(date));
    const item = day.checkItems.find((it) => it.id === id);
    if (!item) return null;
    if (patch.text !== undefined) item.text = patch.text;
    if (patch.done !== undefined) item.done = patch.done;
    await this.commit(day, null);
    return item;
  }

  async removeCheckItem(date: string, id: string): Promise<boolean> {
    const day = structuredClone(this.getDay(date));
    const before = day.checkItems.length;
    day.checkItems = day.checkItems.filter((it) => it.id !== id);
    if (day.checkItems.length === before) return false;
    await this.commit(day, null);
    return true;
  }

  /** Reorder by an explicit id sequence; ids not listed keep their relative order at the end. */
  async reorderCheckItems(date: string, orderedIds: string[]): Promise<DayEntry> {
    const day = structuredClone(this.getDay(date));
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    const ordered = this.sortedItems(day).sort((a, b) => {
      const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    day.checkItems = ordered.map((it, i) => ({ ...it, order: i }));
    await this.commit(day, null);
    return day;
  }

  async setAgenda(date: string, hour: number, text: string): Promise<DayEntry> {
    const day = structuredClone(this.getDay(date));
    if (text.trim() === '') {
      delete day.agenda[hour];
    } else {
      day.agenda[hour] = text;
    }
    await this.commit(day, null);
    return day;
  }
}

export function isValidHour(hour: number): boolean {
  return Number.isInteger(hour) && hour >= AGENDA_START_HOUR && hour <= AGENDA_END_HOUR;
}

export const store = new Store();
