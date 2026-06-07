import { useCallback, useEffect, useRef, useState } from 'react';
import type { DayEntry } from './types';
import { emptyDay, getDay, saveDay } from './db';

const SAVE_DEBOUNCE_MS = 300;

interface UseDay {
  entry: DayEntry;
  loading: boolean;
  /** Apply an immutable update to the current day; triggers a debounced save. */
  update: (mutate: (prev: DayEntry) => DayEntry) => void;
}

/**
 * Owns the DayEntry for a given date: loads it, keeps it in local state,
 * and autosaves edits on a debounce. Switching dates flushes any pending
 * save first, so in-flight edits to the previous day are never dropped.
 */
export function useDay(date: string): UseDay {
  const [entry, setEntry] = useState<DayEntry>(() => emptyDay(date));
  const [loading, setLoading] = useState(true);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The entry currently waiting to be flushed, if any. */
  const pending = useRef<DayEntry | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const toSave = pending.current;
      pending.current = null;
      void saveDay(toSave);
    }
  }, []);

  // Load on date change; flush the outgoing day first.
  useEffect(() => {
    let active = true;
    flush();
    setLoading(true);
    void getDay(date).then((loaded) => {
      if (!active) return;
      setEntry(loaded);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [date, flush]);

  // Persist before the tab is closed/navigated away.
  useEffect(() => {
    window.addEventListener('beforeunload', flush);
    return () => {
      flush();
      window.removeEventListener('beforeunload', flush);
    };
  }, [flush]);

  const update = useCallback((mutate: (prev: DayEntry) => DayEntry) => {
    setEntry((prev) => {
      const next = mutate(prev);
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (pending.current) {
          const toSave = pending.current;
          pending.current = null;
          void saveDay(toSave);
        }
      }, SAVE_DEBOUNCE_MS);
      return next;
    });
  }, []);

  return { entry, loading, update };
}
