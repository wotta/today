import type { DayEntry } from './types';
import type { RemoteChange } from './api';
import * as api from './api';
import * as gist from './gist';
import { getGistConfig } from './settings';

export { CLIENT_ID } from './api';
export type { RemoteChange } from './api';

/**
 * Storage backend selector. When a valid GistConfig exists, all calls route to
 * the GitHub Gist backend; otherwise they go to the local helper server. The
 * choice is read once and cached for the session — connecting/disconnecting
 * Gist happens on the Options page, after which the new-tab page reloads.
 */
type Backend = Pick<typeof api, 'fetchDay' | 'fetchAllDays' | 'putDay' | 'beaconDay' | 'subscribe'>;

let selected: Promise<Backend> | null = null;

function backend(): Promise<Backend> {
  if (!selected) {
    selected = getGistConfig().then((config) => (config ? gist : api));
  }
  return selected;
}

export async function fetchDay(date: string): Promise<DayEntry> {
  return (await backend()).fetchDay(date);
}

/** Full days map from the active backend (server or Gist), for export. */
export async function fetchAllDays(): Promise<Record<string, DayEntry>> {
  return (await backend()).fetchAllDays();
}

export async function putDay(entry: DayEntry): Promise<void> {
  return (await backend()).putDay(entry);
}

export function beaconDay(entry: DayEntry): void {
  void backend().then((b) => b.beaconDay(entry));
}

export function subscribe(
  onChange: (change: RemoteChange) => void,
  onConnection: (online: boolean) => void,
): () => void {
  let cancelled = false;
  let inner: () => void = () => {};
  void backend().then((b) => {
    if (!cancelled) inner = b.subscribe(onChange, onConnection);
  });
  return () => {
    cancelled = true;
    inner();
  };
}

/** Whether the Gist backend is active — used by the UI to label the sync status. */
export async function isGistActive(): Promise<boolean> {
  return (await getGistConfig()) !== null;
}

/** Test seam: forget the cached backend selection. */
export function __resetBackend(): void {
  selected = null;
}
