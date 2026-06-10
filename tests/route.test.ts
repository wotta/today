import { describe, expect, it } from 'vitest';
import { noteHash, parseRoute } from '../entrypoints/newtab/lib/route';

describe('parseRoute', () => {
  it('routes the empty/unknown hash to the planner', () => {
    expect(parseRoute('')).toEqual({ view: 'planner' });
    expect(parseRoute('#/')).toEqual({ view: 'planner' });
    expect(parseRoute('#/nope')).toEqual({ view: 'planner' });
  });

  it('parses a per-day note route', () => {
    expect(parseRoute('#/note/2026-06-10')).toEqual({
      view: 'note',
      date: '2026-06-10',
      hour: undefined,
    });
  });

  it('parses a per-slot note route', () => {
    expect(parseRoute('#/note/2026-06-10/14')).toEqual({
      view: 'note',
      date: '2026-06-10',
      hour: 14,
    });
  });

  it('rejects hours outside the agenda range', () => {
    expect(parseRoute('#/note/2026-06-10/5')).toEqual({ view: 'planner' });
    expect(parseRoute('#/note/2026-06-10/27')).toEqual({ view: 'planner' });
  });
});

describe('noteHash', () => {
  it('round-trips through parseRoute', () => {
    expect(parseRoute(noteHash('2026-06-10'))).toEqual({
      view: 'note',
      date: '2026-06-10',
      hour: undefined,
    });
    expect(parseRoute(noteHash('2026-06-10', 9))).toEqual({
      view: 'note',
      date: '2026-06-10',
      hour: 9,
    });
  });
});
