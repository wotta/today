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
import { getGistConfig } from './config';
import { loadDays as gistLoad, saveDays as gistSave } from './gist';

export const DATA_PATH = process.env.TODAY_DATA
  ? path.resolve(process.env.TODAY_DATA)
  : path.join(os.homedir(), '.today', 'data.json');

/** Emitted whenever a day changes. `origin` is the writing client id (null for MCP edits). */
export interface ChangeEvent {
  date: string;
  origin: string | null;
}

type Days = Record<string, DayEntry>;

/**
 * A durable store of the `days` map. There are two: the local JSON file and a
 * GitHub Gist. The active one is chosen per-operation from the current config,
 * so the whole server follows the same "gist mode" switch as the extension.
 */
interface Persistence {
  load(): Promise<Days>;
  save(days: Days): Promise<void>;
}

const filePersistence: Persistence = {
  async load() {
    try {
      const raw = await fs.readFile(DATA_PATH, 'utf8');
      const parsed = JSON.parse(raw) as { days?: Days };
      return parsed.days ?? {};
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('today: could not read data file, starting empty:', err);
      }
      return {};
    }
  },
  async save(days) {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    // Atomic write: temp file + rename.
    const tmp = `${DATA_PATH}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ days }, null, 2), 'utf8');
    await fs.rename(tmp, DATA_PATH);
  },
};

function gistPersistence(): Persistence {
  // Non-null: only used when getGistConfig() returned a config.
  const cfg = getGistConfig()!;
  return { load: () => gistLoad(cfg), save: (days) => gistSave(cfg, days) };
}

function hasContent(e: DayEntry): boolean {
  if (e.checkItems.length > 0) return true;
  return Object.values(e.agenda).some((t) => t.trim() !== '');
}

class Store extends EventEmitter {
  /** Serializes writes so concurrent load-modify-save cycles can't interleave. */
  private writeChain: Promise<void> = Promise.resolve();

  /** Gist when configured, else the local file. Read fresh each call. */
  private backend(): Persistence {
    return getGistConfig() ? gistPersistence() : filePersistence;
  }

  /** Kept for the startup call; state is now loaded per-operation. */
  async init(): Promise<void> {}

  async getDay(date: string): Promise<DayEntry> {
    const days = await this.backend().load();
    return days[date] ?? emptyDay(date);
  }

  async listDays(): Promise<Array<{ date: string; checkItems: number; agendaEntries: number }>> {
    const days = await this.backend().load();
    return Object.values(days)
      .filter(hasContent)
      .map((e) => ({
        date: e.date,
        checkItems: e.checkItems.length,
        agendaEntries: Object.values(e.agenda).filter((t) => t.trim() !== '').length,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  /**
   * Load the latest days, apply `fn` to one day, then save and notify. `fn`
   * returns the updated day, or null to abort without writing. Serialized via
   * writeChain; loading fresh each time keeps the local file and the Gist
   * (which the extension also writes) from clobbering unrelated days.
   */
  private mutate(
    date: string,
    fn: (day: DayEntry) => DayEntry | null,
    origin: string | null,
  ): Promise<DayEntry | null> {
    const run = this.writeChain.then(async () => {
      const backend = this.backend();
      const days = await backend.load();
      const next = fn(structuredClone(days[date] ?? emptyDay(date)));
      if (next === null) return null;
      if (hasContent(next)) {
        days[date] = next;
      } else {
        delete days[date];
      }
      await backend.save(days);
      this.emit('change', { date, origin } satisfies ChangeEvent);
      return next;
    });
    // Keep the chain alive across failures, but still surface them to the caller.
    this.writeChain = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  putDay(entry: DayEntry, origin: string | null): Promise<DayEntry> {
    return this.mutate(entry.date, () => entry, origin) as Promise<DayEntry>;
  }

  async addCheckItem(date: string, text: string): Promise<CheckItem> {
    let created: CheckItem | null = null;
    await this.mutate(
      date,
      (day) => {
        const order = day.checkItems.reduce((max, it) => Math.max(max, it.order), -1) + 1;
        created = { id: randomUUID(), text, done: false, order };
        day.checkItems.push(created);
        return day;
      },
      null,
    );
    return created!;
  }

  async updateCheckItem(
    date: string,
    id: string,
    patch: { text?: string; done?: boolean },
  ): Promise<CheckItem | null> {
    let updated: CheckItem | null = null;
    await this.mutate(
      date,
      (day) => {
        const item = day.checkItems.find((it) => it.id === id);
        if (!item) return null;
        if (patch.text !== undefined) item.text = patch.text;
        if (patch.done !== undefined) item.done = patch.done;
        updated = item;
        return day;
      },
      null,
    );
    return updated;
  }

  async removeCheckItem(date: string, id: string): Promise<boolean> {
    let removed = false;
    await this.mutate(
      date,
      (day) => {
        const before = day.checkItems.length;
        day.checkItems = day.checkItems.filter((it) => it.id !== id);
        if (day.checkItems.length === before) return null;
        removed = true;
        return day;
      },
      null,
    );
    return removed;
  }

  /** Reorder by an explicit id sequence; ids not listed keep their relative order at the end. */
  reorderCheckItems(date: string, orderedIds: string[]): Promise<DayEntry> {
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    return this.mutate(
      date,
      (day) => {
        const ordered = [...day.checkItems].sort((a, b) => {
          const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
          const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
          return ra - rb;
        });
        day.checkItems = ordered.map((it, i) => ({ ...it, order: i }));
        return day;
      },
      null,
    ) as Promise<DayEntry>;
  }

  setAgenda(date: string, hour: number, text: string): Promise<DayEntry> {
    return this.mutate(
      date,
      (day) => {
        if (text.trim() === '') {
          delete day.agenda[hour];
        } else {
          day.agenda[hour] = text;
        }
        return day;
      },
      null,
    ) as Promise<DayEntry>;
  }
}

export function isValidHour(hour: number): boolean {
  return Number.isInteger(hour) && hour >= AGENDA_START_HOUR && hour <= AGENDA_END_HOUR;
}

export const store = new Store();
