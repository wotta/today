import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  db,
  emptyDay,
  exportAll,
  getDay,
  importDays,
  saveDay,
  type ExportEnvelope,
} from '../entrypoints/newtab/lib/db';
import type { DayEntry } from '../entrypoints/newtab/lib/types';

beforeEach(async () => {
  await db.days.clear();
});

function dayWithCheck(date: string): DayEntry {
  return {
    date,
    checkItems: [{ id: 'a', text: 'buy milk', done: false, order: 0 }],
    agenda: {},
  };
}

describe('getDay / emptyDay', () => {
  it('returns an empty (unpersisted) day when none is stored', async () => {
    const day = await getDay('2026-06-08');
    expect(day).toEqual({ date: '2026-06-08', checkItems: [], agenda: {} });
    // getDay must not have written the empty day.
    expect(await db.days.get('2026-06-08')).toBeUndefined();
  });

  it('returns the stored record when one exists', async () => {
    const stored = dayWithCheck('2026-06-08');
    await db.days.put(stored);
    expect(await getDay('2026-06-08')).toEqual(stored);
  });
});

describe('saveDay (lazy cleanup)', () => {
  it('persists a day that has a check item', async () => {
    await saveDay(dayWithCheck('2026-06-08'));
    expect(await db.days.get('2026-06-08')).toBeDefined();
  });

  it('persists a day whose only content is agenda text', async () => {
    await saveDay({ date: '2026-06-08', checkItems: [], agenda: { 9: 'standup' } });
    expect(await db.days.get('2026-06-08')).toBeDefined();
  });

  it('deletes an existing day once it becomes empty', async () => {
    await saveDay(dayWithCheck('2026-06-08'));
    await saveDay(emptyDay('2026-06-08'));
    expect(await db.days.get('2026-06-08')).toBeUndefined();
  });

  it('treats whitespace-only agenda text as empty', async () => {
    await saveDay({ date: '2026-06-08', checkItems: [], agenda: { 9: '   ' } });
    expect(await db.days.get('2026-06-08')).toBeUndefined();
  });
});

describe('exportAll', () => {
  it('writes a v1 envelope containing every stored day', async () => {
    // exportAll triggers a download via an <a> click + object URL; stub those out.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let captured = '';
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob) => {
        // Blob.text() is async; read synchronously isn't possible, so stash the blob.
        (createUrl as unknown as { blob: Blob }).blob = blob as Blob;
        return 'blob:mock';
      });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await saveDay(dayWithCheck('2026-06-08'));
    await saveDay({ date: '2026-06-09', checkItems: [], agenda: { 10: 'lunch' } });
    await exportAll();

    captured = await (createUrl as unknown as { blob: Blob }).blob.text();
    const envelope = JSON.parse(captured) as ExportEnvelope;

    expect(envelope.version).toBe(1);
    expect(typeof envelope.exportedAt).toBe('string');
    expect(Object.keys(envelope.days).sort()).toEqual(['2026-06-08', '2026-06-09']);
    expect(clickSpy).toHaveBeenCalled();
  });
});

describe('importDays', () => {
  function envelopeFile(days: Record<string, unknown>): File {
    const envelope = { version: 1, exportedAt: '2026-06-08T00:00:00.000Z', days };
    return new File([JSON.stringify(envelope)], 'import.json', { type: 'application/json' });
  }

  it('imports new days and skips ones that already exist', async () => {
    await saveDay(dayWithCheck('2026-06-08'));
    const file = envelopeFile({
      '2026-06-08': dayWithCheck('2026-06-08'), // already exists -> skip
      '2026-06-09': dayWithCheck('2026-06-09'), // new -> import
    });

    const result = await importDays(file);

    expect(result).toEqual({ imported: 1, skipped: 1 });
    expect(await db.days.get('2026-06-09')).toBeDefined();
  });

  it('rejects a non-JSON file', async () => {
    const file = new File(['not json'], 'x.json', { type: 'application/json' });
    await expect(importDays(file)).rejects.toThrow('Invalid file');
  });

  it('rejects an envelope without version/days', async () => {
    const file = new File([JSON.stringify({ foo: 'bar' })], 'x.json');
    await expect(importDays(file)).rejects.toThrow('Unrecognised format');
  });

  it('skips a malformed day entry without aborting the rest', async () => {
    const file = envelopeFile({
      '2026-06-08': { date: '2026-06-08' }, // missing checkItems/agenda -> skip
      '2026-06-09': dayWithCheck('2026-06-09'), // valid -> import
    });

    const result = await importDays(file);

    expect(result).toEqual({ imported: 1, skipped: 1 });
    expect(await db.days.get('2026-06-09')).toBeDefined();
  });

  it('calls serverPut for each imported day but survives its failure', async () => {
    const serverPut = vi
      .fn<(entry: DayEntry) => Promise<void>>()
      .mockRejectedValue(new Error('server down'));
    const file = envelopeFile({ '2026-06-09': dayWithCheck('2026-06-09') });

    const result = await importDays(file, serverPut);

    expect(serverPut).toHaveBeenCalledOnce();
    // Failure is swallowed; the day still lands in IndexedDB.
    expect(result.imported).toBe(1);
    expect(await db.days.get('2026-06-09')).toBeDefined();
  });
});
