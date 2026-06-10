import { describe, expect, it } from 'vitest';
import { withNote } from '../entrypoints/newtab/lib/notes';
import type { DayEntry } from '../entrypoints/newtab/lib/types';

function day(over: Partial<DayEntry> = {}): DayEntry {
  return { date: '2026-06-10', checkItems: [], agenda: {}, ...over };
}

describe('withNote', () => {
  it('sets and clears the day note without leaving an empty field', () => {
    const set = withNote(day(), undefined, 'plan');
    expect(set.note).toBe('plan');

    const cleared = withNote(set, undefined, '');
    expect(cleared).not.toHaveProperty('note');
  });

  it('clearing a slot note removes the key instead of storing ""', () => {
    const prev = day({ slotNotes: { 9: 'standup', 14: 'dentist' } });

    const next = withNote(prev, 14, '');

    expect(next.slotNotes).toEqual({ 9: 'standup' });
  });

  it('clearing the last slot note removes the slotNotes field entirely', () => {
    const prev = day({ slotNotes: { 14: 'dentist' } });

    expect(withNote(prev, 14, '')).not.toHaveProperty('slotNotes');
  });

  it('does not mutate the previous entry', () => {
    const prev = day({ slotNotes: { 14: 'dentist' } });
    withNote(prev, 14, '');
    expect(prev.slotNotes).toEqual({ 14: 'dentist' });
  });
});
