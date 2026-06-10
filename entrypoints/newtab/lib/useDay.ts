import { useCallback, useEffect, useRef, useState } from 'react';
import type { DayEntry } from './types';
import { emptyDay, getDay as getCached, saveDay as saveCache } from './db';
import * as api from './backend';

const SAVE_DEBOUNCE_MS = 300;

export interface UseDay {
  entry: DayEntry;
  loading: boolean;
  /** Whether the helper server (the source of truth) is currently reachable. */
  online: boolean;
  /** Apply an immutable update to the current day; triggers a debounced save. */
  update: (mutate: (prev: DayEntry) => DayEntry) => void;
  /** Set each time a (debounced) save completes; `online` is the result of that save. */
  lastSaved: { at: number; online: boolean } | null;
}

/**
 * Owns the DayEntry for a date. The helper server is the source of truth; the
 * IndexedDB copy is an offline cache. Reads prefer the server and fall back to
 * the cache; writes go to both (debounced). A server-sent change feed keeps an
 * open tab in sync with edits made by AI tools, and reconnecting re-pushes what
 * the tab is showing so visible edits win.
 */
export function useDay(date: string): UseDay {
  const [entry, setEntry] = useState<DayEntry>(() => emptyDay(date));
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [lastSaved, setLastSaved] = useState<UseDay['lastSaved']>(null);

  const dateRef = useRef(date);
  dateRef.current = date;
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const onlineRef = useRef(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<DayEntry | null>(null);

  const markOnline = useCallback((value: boolean) => {
    onlineRef.current = value;
    setOnline(value);
  }, []);

  /** Cache locally (always) and write through to the server (when reachable). */
  const persist = useCallback(
    async (next: DayEntry) => {
      await saveCache(next);
      let serverOk = true;
      try {
        await api.putDay(next);
        markOnline(true);
      } catch {
        serverOk = false;
        markOnline(false);
      }
      setLastSaved({ at: Date.now(), online: serverOk });
    },
    [markOnline],
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const next = pending.current;
      pending.current = null;
      void persist(next);
    }
  }, [persist]);

  // Load when the date changes; flush the outgoing day first.
  useEffect(() => {
    let active = true;
    flush();
    setLoading(true);
    (async () => {
      try {
        const server = await api.fetchDay(date);
        if (!active) return;
        setEntry(server);
        markOnline(true);
        void saveCache(server);
      } catch {
        if (!active) return;
        const cached = await getCached(date);
        if (!active) return;
        setEntry(cached);
        markOnline(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [date, flush, markOnline]);

  // Live updates from the server (e.g. an AI tool edited the same day).
  useEffect(() => {
    const unsubscribe = api.subscribe(
      (change) => {
        // Ignore our own write echoes and changes to other days.
        if (change.origin === api.CLIENT_ID || change.date !== dateRef.current) return;
        // Don't clobber edits the user is mid-typing (a debounced save is queued).
        if (pending.current) return;
        api
          .fetchDay(change.date)
          .then((fresh) => {
            if (dateRef.current === fresh.date && !pending.current) {
              setEntry(fresh);
              void saveCache(fresh);
            }
          })
          .catch(() => {});
      },
      (isOnline) => {
        if (isOnline && !onlineRef.current) {
          if (pending.current) {
            // Unsaved local edits take priority — push them to the server.
            void persist(entryRef.current);
          } else {
            // No local edits: pull from the server so we don't overwrite good data
            // with stale/empty state (e.g. after Chrome cleared IndexedDB on reload).
            api
              .fetchDay(dateRef.current)
              .then((fresh) => {
                if (!pending.current) {
                  setEntry(fresh);
                  void saveCache(fresh);
                }
              })
              .catch(() => {});
          }
        }
        markOnline(isOnline);
      },
    );
    return unsubscribe;
  }, [persist, markOnline]);

  // Best-effort save before the tab closes.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (pending.current) {
        api.beaconDay(pending.current);
        void saveCache(pending.current);
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      flush();
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [flush]);

  const update = useCallback(
    (mutate: (prev: DayEntry) => DayEntry) => {
      setEntry((prev) => {
        const next = mutate(prev);
        pending.current = next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          if (pending.current) {
            const toSave = pending.current;
            pending.current = null;
            void persist(toSave);
          }
        }, SAVE_DEBOUNCE_MS);
        return next;
      });
    },
    [persist],
  );

  return { entry, loading, online, update, lastSaved };
}
