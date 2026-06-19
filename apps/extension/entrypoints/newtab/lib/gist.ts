import type { DayEntry } from './types';
import { emptyDay } from './db';
import { getGistConfig, type GistConfig } from './settings';
import type { RemoteChange } from './api';

export { CLIENT_ID } from './api';
export type { RemoteChange } from './api';

const API = 'https://api.github.com';
const GIST_FILE = 'today-data.json';

/** Versioned envelope shared with the export/import format. */
interface Envelope {
  version: 1;
  exportedAt: string;
  days: Record<string, DayEntry>;
}

export type GistErrorKind = 'unauthorized' | 'not-found' | 'rate-limited' | 'unknown';

/** Typed failure so callers (backend / options UI) can react to auth vs missing vs rate-limit. */
export class GistError extends Error {
  constructor(
    readonly kind: GistErrorKind,
    readonly status: number,
    message?: string,
  ) {
    super(message ?? `Gist request failed (${kind}, ${status})`);
    this.name = 'GistError';
  }
}

function errorKind(status: number): GistErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status === 403 || status === 429) return 'rate-limited';
  return 'unknown';
}

function headers(pat: string): HeadersInit {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
  };
}

async function ghFetch(path: string, pat: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(pat), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new GistError(errorKind(res.status), res.status);
  return res;
}

function hasContent(entry: DayEntry): boolean {
  if (entry.checkItems.length > 0) return true;
  return Object.values(entry.agenda).some((text) => text.trim() !== '');
}

// --- Options-page helpers (validate / create / verify) ---

/**
 * Find an existing Gist that already holds `today-data.json` and return its id,
 * or null if none. Also doubles as PAT validation (throws GistError on 401).
 * Only the first page (100 most recent gists) is scanned — enough in practice.
 */
export async function findGistWithData(pat: string): Promise<string | null> {
  const res = await ghFetch('/gists?per_page=100', pat, { method: 'GET' });
  const gists = (await res.json()) as Array<{ id: string; files?: Record<string, unknown> }>;
  const match = gists.find((g) => g.files && GIST_FILE in g.files);
  return match ? match.id : null;
}

/** Create a new private Gist seeded with an empty envelope; returns its id. */
export async function createGist(pat: string): Promise<string> {
  const seed: Envelope = { version: 1, exportedAt: new Date().toISOString(), days: {} };
  const res = await ghFetch('/gists', pat, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Today planner data',
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify(seed, null, 2) } },
    }),
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

/** Verify a Gist exists and is reachable with this PAT. Throws GistError otherwise. */
export async function verifyGist(pat: string, gistId: string): Promise<void> {
  await ghFetch(`/gists/${gistId}`, pat, { method: 'GET' });
}

// --- Backend interface (mirrors api.ts) ---

/** In-memory copy of the full `days` object, loaded once per session. */
let cache: Record<string, DayEntry> | null = null;

async function readFileContent(gist: {
  files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }>;
}): Promise<string> {
  const file = gist.files[GIST_FILE];
  if (!file) return JSON.stringify({ version: 1, days: {} });
  // GitHub truncates large file content in the gist response; fetch the raw blob.
  if (file.truncated && file.raw_url) {
    return await (await fetch(file.raw_url)).text();
  }
  return file.content ?? JSON.stringify({ version: 1, days: {} });
}

async function load(config: GistConfig): Promise<Record<string, DayEntry>> {
  const res = await ghFetch(`/gists/${config.gistId}`, config.pat, { method: 'GET' });
  const gist = (await res.json()) as Parameters<typeof readFileContent>[0];
  const text = await readFileContent(gist);
  let parsed: Partial<Envelope>;
  try {
    parsed = JSON.parse(text) as Partial<Envelope>;
  } catch {
    parsed = {};
  }
  return parsed.days ?? {};
}

async function ensureLoaded(): Promise<Record<string, DayEntry>> {
  if (cache) return cache;
  const config = await getGistConfig();
  if (!config) throw new GistError('unknown', 0, 'Gist not configured');
  cache = await load(config);
  return cache;
}

async function save(days: Record<string, DayEntry>): Promise<void> {
  const config = await getGistConfig();
  if (!config) throw new GistError('unknown', 0, 'Gist not configured');
  const envelope: Envelope = { version: 1, exportedAt: new Date().toISOString(), days };
  await ghFetch(`/gists/${config.gistId}`, config.pat, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(envelope, null, 2) } } }),
  });
}

export async function fetchDay(date: string): Promise<DayEntry> {
  const days = await ensureLoaded();
  return days[date] ?? emptyDay(date);
}

/** Latest full days map from the Gist (fresh read; refreshes the session cache). */
export async function fetchAllDays(): Promise<Record<string, DayEntry>> {
  const config = await getGistConfig();
  if (!config) throw new GistError('unknown', 0, 'Gist not configured');
  const days = await load(config);
  cache = days;
  return days;
}

export async function putDay(entry: DayEntry): Promise<void> {
  const config = await getGistConfig();
  if (!config) throw new GistError('unknown', 0, 'Gist not configured');
  // Re-read the latest before writing so we don't clobber edits made elsewhere
  // (e.g. an AI tool via the MCP server, which writes the same Gist).
  const days = await load(config);
  if (hasContent(entry)) {
    days[entry.date] = entry;
  } else {
    delete days[entry.date];
  }
  cache = days;
  await save(days);
}

/** No unload beacon for Gist — there's no low-latency write path. */
export function beaconDay(_entry: DayEntry): void {}

const POLL_INTERVAL_MS = 10_000;

/** Dates whose stored entry differs between two day maps (added, removed, or edited). */
function changedDates(
  before: Record<string, DayEntry>,
  after: Record<string, DayEntry>,
): string[] {
  const dates = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const date of dates) {
    if (JSON.stringify(before[date]) !== JSON.stringify(after[date])) changed.push(date);
  }
  return changed;
}

/**
 * Gist has no push feed, so we poll every 10s. Each tick re-reads the Gist,
 * refreshes the in-memory cache, and fires onChange for any day that changed
 * since the last read (e.g. an AI tool edited it via the MCP server, which
 * writes the same Gist). The returned function stops polling.
 */
export function subscribe(
  onChange: (change: RemoteChange) => void,
  onConnection: (online: boolean) => void,
): () => void {
  let stopped = false;

  // Optimistically report connected; the first poll corrects it if unreachable.
  onConnection(true);

  const poll = async () => {
    const config = await getGistConfig();
    if (!config || stopped) return;
    try {
      const fresh = await load(config);
      if (stopped) return;
      if (cache) {
        for (const date of changedDates(cache, fresh)) {
          onChange({ date, origin: null });
        }
      }
      cache = fresh;
      onConnection(true);
    } catch {
      if (!stopped) onConnection(false);
    }
  };

  const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/** Test seam: drop the in-memory cache so the next call re-fetches. */
export function __resetCache(): void {
  cache = null;
}
