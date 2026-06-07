import type { DayEntry } from './types';

/** Must match the helper server's default port (TODAY_PORT). */
const PORT = 8765;
export const SERVER_BASE = `http://127.0.0.1:${PORT}`;

/** Per-session id so we can ignore the change events caused by our own writes. */
export const CLIENT_ID =
  globalThis.crypto?.randomUUID?.() ?? `c-${Math.random().toString(36).slice(2)}`;

export async function fetchDay(date: string): Promise<DayEntry> {
  const res = await fetch(`${SERVER_BASE}/api/day/${date}`);
  if (!res.ok) throw new Error(`getDay failed: ${res.status}`);
  return (await res.json()) as DayEntry;
}

export async function putDay(entry: DayEntry): Promise<void> {
  const res = await fetch(`${SERVER_BASE}/api/day/${entry.date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Today-Client': CLIENT_ID },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`putDay failed: ${res.status}`);
}

/** Best-effort save during page unload (can't set custom headers, so origin goes in the query). */
export function beaconDay(entry: DayEntry): void {
  try {
    const url = `${SERVER_BASE}/api/day/${entry.date}?origin=${encodeURIComponent(CLIENT_ID)}`;
    navigator.sendBeacon?.(url, new Blob([JSON.stringify(entry)], { type: 'application/json' }));
  } catch {
    /* ignore */
  }
}

export interface RemoteChange {
  date: string;
  origin: string | null;
}

/** Give up reconnecting after this many consecutive failures, so an offline server doesn't spam the console. */
const MAX_RETRIES = 3;

/**
 * Subscribe to the server's live change feed. Auto-reconnects with a short backoff,
 * but stops after MAX_RETRIES consecutive failures (the server is treated as offline).
 * A successful connection resets the counter.
 * `onChange` fires for every day-changed event; `onConnection` reports stream up/down.
 * Returns an unsubscribe function.
 */
export function subscribe(
  onChange: (change: RemoteChange) => void,
  onConnection: (online: boolean) => void,
): () => void {
  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let failures = 0;

  const connect = () => {
    if (closed) return;
    source = new EventSource(`${SERVER_BASE}/api/events`);
    source.onopen = () => {
      failures = 0;
      onConnection(true);
    };
    source.onmessage = (e) => {
      try {
        onChange(JSON.parse(e.data) as RemoteChange);
      } catch {
        /* ignore malformed */
      }
    };
    source.onerror = () => {
      onConnection(false);
      source?.close();
      source = null;
      if (closed) return;
      failures += 1;
      // Stop after MAX_RETRIES; the user can re-trigger a connect by reloading the tab.
      if (failures >= MAX_RETRIES) return;
      retry = setTimeout(connect, 3000);
    };
  };

  connect();
  return () => {
    closed = true;
    source?.close();
    if (retry) clearTimeout(retry);
  };
}
