import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayEntry } from '../entrypoints/newtab/lib/types';
import type { RemoteChange } from '../entrypoints/newtab/lib/api';

// Drive the backend by hand: we capture subscribe's callbacks so tests can
// simulate the server going down / coming back and pushing change events.
// vi.mock is hoisted, so the shared state must live in vi.hoisted().
const CLIENT_ID = 'test-client';
const h = vi.hoisted(() => {
  const fetchDay = vi.fn<(date: string) => Promise<DayEntry>>();
  const putDay = vi.fn<(entry: DayEntry) => Promise<void>>();
  const beaconDay = vi.fn();
  const cb: {
    onChange: (c: RemoteChange) => void;
    onConnection: (online: boolean) => void;
  } = { onChange: () => {}, onConnection: () => {} };
  return { fetchDay, putDay, beaconDay, cb };
});
const { fetchDay, putDay, beaconDay, cb } = h;

vi.mock('../entrypoints/newtab/lib/backend', () => ({
  CLIENT_ID: 'test-client',
  fetchDay: (date: string) => h.fetchDay(date),
  putDay: (entry: DayEntry) => h.putDay(entry),
  beaconDay: (entry: DayEntry) => h.beaconDay(entry),
  subscribe: (
    change: (c: RemoteChange) => void,
    connection: (online: boolean) => void,
  ) => {
    h.cb.onChange = change;
    h.cb.onConnection = connection;
    return () => {};
  },
}));

import { useDay } from '../entrypoints/newtab/lib/useDay';
import { db, saveDay } from '../entrypoints/newtab/lib/db';

const serverDay: DayEntry = {
  date: '2026-06-08',
  checkItems: [{ id: 'a', text: 'from server', done: false, order: 0 }],
  agenda: {},
};

beforeEach(async () => {
  await db.days.clear();
  fetchDay.mockReset().mockResolvedValue(serverDay);
  putDay.mockReset().mockResolvedValue(undefined);
  beaconDay.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDay loading', () => {
  it('loads from the server on mount and reports online', async () => {
    const { result } = renderHook(() => useDay('2026-06-08'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entry).toEqual(serverDay);
    expect(result.current.online).toBe(true);
  });

  it('falls back to the IndexedDB cache when the server is unreachable', async () => {
    const cached: DayEntry = {
      date: '2026-06-08',
      checkItems: [{ id: 'c', text: 'from cache', done: true, order: 0 }],
      agenda: {},
    };
    await saveDay(cached);
    fetchDay.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useDay('2026-06-08'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entry).toEqual(cached);
    expect(result.current.online).toBe(false);
  });
});

describe('useDay saving', () => {
  it('debounces saves so rapid edits produce a single server write', async () => {
    const { result } = renderHook(() => useDay('2026-06-08'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.update((d) => ({ ...d, agenda: { 9: 'a' } }));
      result.current.update((d) => ({ ...d, agenda: { 9: 'ab' } }));
      result.current.update((d) => ({ ...d, agenda: { 9: 'abc' } }));
    });

    await waitFor(() => expect(putDay).toHaveBeenCalledTimes(1));
    expect(putDay.mock.calls[0][0].agenda).toEqual({ 9: 'abc' });
  });
});

describe('useDay reconnect', () => {
  it('pulls from the server when reconnecting with no pending edits', async () => {
    const { result } = renderHook(() => useDay('2026-06-08'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchDay.mockClear();

    const updated: DayEntry = { ...serverDay, agenda: { 10: 'changed elsewhere' } };
    fetchDay.mockResolvedValue(updated);

    // Server drops, then comes back with no local edits queued.
    act(() => cb.onConnection(false));
    act(() => cb.onConnection(true));

    await waitFor(() => expect(result.current.entry).toEqual(updated));
    expect(putDay).not.toHaveBeenCalled();
  });

  it('pushes local edits when reconnecting with pending edits', async () => {
    const { result } = renderHook(() => useDay('2026-06-08'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Edit; the 300ms debounced save hasn't fired yet, so it's still pending.
    act(() => {
      result.current.update((d) => ({ ...d, agenda: { 9: 'local edit' } }));
    });

    // Reconnecting while an edit is pending must push it (not pull and clobber it).
    act(() => {
      cb.onConnection(false);
      cb.onConnection(true);
    });

    await waitFor(() => expect(putDay).toHaveBeenCalled());
    expect(putDay.mock.calls.at(-1)![0].agenda).toEqual({ 9: 'local edit' });
  });
});

describe('useDay change feed', () => {
  it('ignores its own write echoes and changes to other dates', async () => {
    const { result } = renderHook(() => useDay('2026-06-08'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchDay.mockClear();

    act(() => cb.onChange({ date: '2026-06-08', origin: CLIENT_ID })); // own echo
    act(() => cb.onChange({ date: '2026-06-09', origin: 'someone' })); // other date

    expect(fetchDay).not.toHaveBeenCalled();
  });

  it('applies a foreign change to the current date', async () => {
    const { result } = renderHook(() => useDay('2026-06-08'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updated: DayEntry = { ...serverDay, agenda: { 11: 'AI edited this' } };
    fetchDay.mockClear().mockResolvedValue(updated);

    act(() => cb.onChange({ date: '2026-06-08', origin: 'an-ai-tool' }));

    await waitFor(() => expect(result.current.entry).toEqual(updated));
  });
});
