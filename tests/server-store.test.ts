// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { server } from './msw';
import type { DayEntry } from '../server/types';

// Control which backend the store routes to.
const cfg = vi.hoisted(() => ({ value: null as null | { pat: string; gistId: string } }));
vi.mock('../server/config', () => ({ getGistConfig: () => cfg.value }));

// Point the file backend at a throwaway path; must be set before importing store.
const DATA = path.join(os.tmpdir(), `today-store-test-${process.pid}.json`);
process.env.TODAY_DATA = DATA;

const { store } = await import('../server/store');

const GIST_URL = 'https://api.github.com/gists/gid';

beforeEach(async () => {
  cfg.value = null;
  await fs.rm(DATA, { force: true });
});

describe('file mode', () => {
  it('persists a put and reads it back', async () => {
    const day: DayEntry = {
      date: '2026-06-08',
      checkItems: [{ id: 'a', text: 'task', done: false, order: 0 }],
      agenda: {},
    };
    await store.putDay(day, null);
    expect(await store.getDay('2026-06-08')).toEqual(day);
  });

  it('adds a checklist item and keeps other days intact (load-modify-save)', async () => {
    await store.addCheckItem('2026-06-08', 'first');
    await store.addCheckItem('2026-06-09', 'other day');

    const day = await store.getDay('2026-06-08');
    expect(day.checkItems.map((it) => it.text)).toEqual(['first']);
    expect((await store.getDay('2026-06-09')).checkItems).toHaveLength(1);
  });

  it('drops a day once it becomes empty (lazy cleanup)', async () => {
    await store.addCheckItem('2026-06-08', 'temp');
    const day = await store.getDay('2026-06-08');
    await store.removeCheckItem('2026-06-08', day.checkItems[0].id);

    expect(await store.listDays()).toEqual([]);
  });

  it('toggling a missing item returns null and writes nothing', async () => {
    expect(await store.updateCheckItem('2026-06-08', 'nope', { done: true })).toBeNull();
    expect(await store.listDays()).toEqual([]);
  });
});

describe('gist mode', () => {
  beforeEach(() => {
    cfg.value = { pat: 'tok', gistId: 'gid' };
  });

  function gistWith(days: Record<string, DayEntry>) {
    const envelope = { version: 1, exportedAt: '2026-06-08T00:00:00.000Z', days };
    return {
      id: 'gid',
      files: { 'today-data.json': { content: JSON.stringify(envelope), truncated: false } },
    };
  }

  it('reads a day from the Gist instead of the file', async () => {
    const day: DayEntry = {
      date: '2026-06-08',
      checkItems: [{ id: 'a', text: 'from gist', done: false, order: 0 }],
      agenda: {},
    };
    server.use(http.get(GIST_URL, () => HttpResponse.json(gistWith({ '2026-06-08': day }))));

    expect(await store.getDay('2026-06-08')).toEqual(day);
    // The local file must remain untouched in gist mode.
    await expect(fs.readFile(DATA, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('writes a put back to the Gist via PATCH', async () => {
    let patched: unknown = null;
    server.use(
      http.get(GIST_URL, () => HttpResponse.json(gistWith({}))),
      http.patch(GIST_URL, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json(gistWith({}));
      }),
    );

    await store.addCheckItem('2026-06-08', 'via mcp');

    const content = (patched as { files: Record<string, { content: string }> }).files[
      'today-data.json'
    ].content;
    const envelope = JSON.parse(content) as { days: Record<string, DayEntry> };
    expect(envelope.days['2026-06-08'].checkItems[0].text).toBe('via mcp');
  });
});
