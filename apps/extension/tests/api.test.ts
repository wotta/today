import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from './msw';
import {
  fetchDay,
  fetchAllDays,
  putDay,
  subscribe,
  SERVER_BASE,
  CLIENT_ID,
} from '../entrypoints/newtab/lib/api';
import type { DayEntry } from '@today/types';

const sample: DayEntry = {
  date: '2026-06-08',
  checkItems: [{ id: 'a', text: 'task', done: false, order: 0 }],
  agenda: { 9: 'standup' },
};

describe('fetchDay', () => {
  it('returns the parsed day on 200', async () => {
    server.use(
      http.get(`${SERVER_BASE}/api/day/:date`, () => HttpResponse.json(sample)),
    );
    expect(await fetchDay('2026-06-08')).toEqual(sample);
  });

  it('throws on a non-200 response', async () => {
    server.use(
      http.get(`${SERVER_BASE}/api/day/:date`, () => new HttpResponse(null, { status: 500 })),
    );
    await expect(fetchDay('2026-06-08')).rejects.toThrow();
  });
});

describe('fetchAllDays', () => {
  it('returns the days map from /api/export', async () => {
    server.use(
      http.get(`${SERVER_BASE}/api/export`, () =>
        HttpResponse.json({ days: { '2026-06-08': sample } }),
      ),
    );
    expect(await fetchAllDays()).toEqual({ '2026-06-08': sample });
  });

  it('throws on a non-200 response', async () => {
    server.use(
      http.get(`${SERVER_BASE}/api/export`, () => new HttpResponse(null, { status: 500 })),
    );
    await expect(fetchAllDays()).rejects.toThrow();
  });
});

describe('putDay', () => {
  it('sends a PUT with the client header and the day as body', async () => {
    let seen: { body: unknown; client: string | null } | null = null;
    server.use(
      http.put(`${SERVER_BASE}/api/day/:date`, async ({ request }) => {
        seen = {
          body: await request.json(),
          client: request.headers.get('X-Today-Client'),
        };
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await putDay(sample);

    expect(seen!.body).toEqual(sample);
    expect(seen!.client).toBe(CLIENT_ID);
  });

  it('throws on a non-200 response', async () => {
    server.use(
      http.put(`${SERVER_BASE}/api/day/:date`, () => new HttpResponse(null, { status: 503 })),
    );
    await expect(putDay(sample)).rejects.toThrow();
  });
});

/** Minimal controllable EventSource stand-in (jsdom has none). */
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  emitOpen() {
    this.onopen?.();
  }
  emitError() {
    this.onerror?.();
  }
}

describe('subscribe', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reports online on open and offline on error', () => {
    const onConnection = vi.fn();
    subscribe(vi.fn(), onConnection);

    const es = MockEventSource.instances[0];
    es.emitOpen();
    expect(onConnection).toHaveBeenLastCalledWith(true);

    es.emitError();
    expect(onConnection).toHaveBeenLastCalledWith(false);
  });

  it('unsubscribe closes the stream and stops reconnecting', () => {
    const unsubscribe = subscribe(vi.fn(), vi.fn());
    const es = MockEventSource.instances[0];
    unsubscribe();
    expect(es.closed).toBe(true);
  });

  it('gives up after 3 consecutive failures', () => {
    vi.useFakeTimers();
    subscribe(vi.fn(), vi.fn());

    // Each error closes the source and schedules a reconnect (except the last).
    for (let i = 0; i < 5; i++) {
      const es = MockEventSource.instances.at(-1)!;
      es.emitError();
      vi.advanceTimersByTime(3000);
    }

    // 1 initial + 2 reconnects = 3 sources; the 3rd failure stops the loop.
    expect(MockEventSource.instances.length).toBe(3);
  });
});
