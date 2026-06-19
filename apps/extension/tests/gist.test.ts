import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from './msw';
import type { DayEntry } from '@today/types';

vi.mock('../entrypoints/newtab/lib/settings', () => ({
  getGistConfig: vi.fn(async () => ({ pat: 'tok', gistId: 'gid' })),
}));

import * as gist from '../entrypoints/newtab/lib/gist';

const GIST_URL = 'https://api.github.com/gists/gid';

const day: DayEntry = {
  date: '2026-06-08',
  checkItems: [{ id: 'a', text: 'task', done: false, order: 0 }],
  agenda: {},
};

function gistWith(days: Record<string, DayEntry>) {
  const envelope = { version: 1, exportedAt: '2026-06-08T00:00:00.000Z', days };
  return {
    id: 'gid',
    files: { 'today-data.json': { content: JSON.stringify(envelope), truncated: false } },
  };
}

beforeEach(() => {
  gist.__resetCache();
});

describe('fetchDay', () => {
  it('returns the requested day from the Gist', async () => {
    server.use(http.get(GIST_URL, () => HttpResponse.json(gistWith({ '2026-06-08': day }))));
    expect(await gist.fetchDay('2026-06-08')).toEqual(day);
  });

  it('returns an empty day when the date is not in the Gist', async () => {
    server.use(http.get(GIST_URL, () => HttpResponse.json(gistWith({}))));
    expect(await gist.fetchDay('2026-06-08')).toEqual({
      date: '2026-06-08',
      checkItems: [],
      agenda: {},
    });
  });

  it('serves a second read from the in-memory cache (no second request)', async () => {
    let gets = 0;
    server.use(
      http.get(GIST_URL, () => {
        gets++;
        return HttpResponse.json(gistWith({ '2026-06-08': day }));
      }),
    );

    await gist.fetchDay('2026-06-08');
    await gist.fetchDay('2026-06-08');

    expect(gets).toBe(1);
  });
});

describe('putDay', () => {
  it('PATCHes the Gist with the updated days object', async () => {
    let patched: unknown = null;
    server.use(
      http.get(GIST_URL, () => HttpResponse.json(gistWith({}))),
      http.patch(GIST_URL, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json(gistWith({ '2026-06-08': day }));
      }),
    );

    await gist.putDay(day);

    const content = (patched as { files: Record<string, { content: string }> }).files[
      'today-data.json'
    ].content;
    const envelope = JSON.parse(content) as { days: Record<string, DayEntry> };
    expect(envelope.days['2026-06-08']).toEqual(day);
  });
});

describe('errors', () => {
  it('throws an unauthorized GistError on 401', async () => {
    server.use(http.get(GIST_URL, () => new HttpResponse(null, { status: 401 })));
    await expect(gist.fetchDay('2026-06-08')).rejects.toMatchObject({
      name: 'GistError',
      kind: 'unauthorized',
    });
  });

  it('throws a not-found GistError on 404', async () => {
    server.use(http.get(GIST_URL, () => new HttpResponse(null, { status: 404 })));
    await expect(gist.fetchDay('2026-06-08')).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('throws a rate-limited GistError on 429', async () => {
    server.use(http.get(GIST_URL, () => new HttpResponse(null, { status: 429 })));
    await expect(gist.fetchDay('2026-06-08')).rejects.toMatchObject({ kind: 'rate-limited' });
  });
});

describe('findGistWithData', () => {
  it('returns the id of a gist that already holds today-data.json', async () => {
    server.use(
      http.get('https://api.github.com/gists', () =>
        HttpResponse.json([
          { id: 'g1', files: { 'notes.txt': {} } },
          { id: 'g2', files: { 'today-data.json': {} } },
        ]),
      ),
    );
    expect(await gist.findGistWithData('tok')).toBe('g2');
  });

  it('returns null when no gist has today-data.json', async () => {
    server.use(
      http.get('https://api.github.com/gists', () =>
        HttpResponse.json([{ id: 'g1', files: { 'a.txt': {} } }]),
      ),
    );
    expect(await gist.findGistWithData('tok')).toBeNull();
  });
});

describe('subscribe (polling)', () => {
  it('reports online immediately and stops cleanly', () => {
    const onConnection = vi.fn();
    const unsub = gist.subscribe(vi.fn(), onConnection);
    expect(onConnection).toHaveBeenCalledWith(true);
    expect(() => unsub()).not.toThrow();
  });

  it('polls every 10s and fires onChange for a day that changed remotely', async () => {
    vi.useFakeTimers();
    try {
      let gets = 0;
      server.use(
        http.get(GIST_URL, () => {
          gets++;
          // Empty on the priming read; the remote day appears by the next poll.
          return HttpResponse.json(gistWith(gets <= 1 ? {} : { '2026-06-08': day }));
        }),
      );

      // Prime the cache (read #1, empty).
      await gist.fetchDay('2026-06-08');

      const onChange = vi.fn();
      const unsub = gist.subscribe(onChange, vi.fn());

      await vi.advanceTimersByTimeAsync(10_000);

      expect(onChange).toHaveBeenCalledWith({ date: '2026-06-08', origin: null });
      unsub();
    } finally {
      vi.useRealTimers();
    }
  });

  it('beaconDay is a no-op', () => {
    expect(() => gist.beaconDay(day)).not.toThrow();
  });
});
