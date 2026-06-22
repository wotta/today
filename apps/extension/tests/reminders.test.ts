import { describe, expect, it } from 'vitest';
import {
  itemsDueForSlot,
  upcomingSlot,
} from '../entrypoints/newtab/lib/reminders';
import type { CheckItem, DayEntry } from '@today/types';

/** Local-time Date for June 11, 2026 at the given time. */
function at(hours: number, minutes: number, seconds = 0): Date {
  return new Date(2026, 5, 11, hours, minutes, seconds);
}

describe('upcomingSlot', () => {
  it('returns the slot when it starts within the lead window', () => {
    expect(upcomingSlot(at(14, 50))).toEqual({
      dateKey: '2026-06-11',
      slot: 15,
      minutesUntil: 10,
    });
    expect(upcomingSlot(at(14, 59, 30))).toEqual({
      dateKey: '2026-06-11',
      slot: 15,
      minutesUntil: 1,
    });
  });

  it('returns null outside the lead window or exactly on a boundary', () => {
    expect(upcomingSlot(at(14, 49))).toBeNull(); // next boundary 15:00 is 11 min off
    expect(upcomingSlot(at(15, 0))).toBeNull(); // on a boundary -> next is 15:15
  });

  it('fires for quarter- and half-hour slots', () => {
    // 14:20 -> 14:30 slot (14.5)
    expect(upcomingSlot(at(14, 20))).toEqual({
      dateKey: '2026-06-11',
      slot: 14.5,
      minutesUntil: 10,
    });
    // 14:05 -> 14:15 slot (14.25)
    expect(upcomingSlot(at(14, 5))).toEqual({
      dateKey: '2026-06-11',
      slot: 14.25,
      minutesUntil: 10,
    });
    // 14:40 -> 14:45 slot (14.75)
    expect(upcomingSlot(at(14, 40))).toEqual({
      dateKey: '2026-06-11',
      slot: 14.75,
      minutesUntil: 5,
    });
  });

  it('maps late-night slots to the previous day (planner hours 24–26)', () => {
    // 23:50 -> midnight slot (24) still on today's page.
    expect(upcomingSlot(at(23, 50))).toEqual({
      dateKey: '2026-06-11',
      slot: 24,
      minutesUntil: 10,
    });
    // 00:50 -> 1am slot (25) on the *previous* day's page.
    expect(upcomingSlot(at(0, 50))).toEqual({
      dateKey: '2026-06-10',
      slot: 25,
      minutesUntil: 10,
    });
  });

  it('returns null for hours outside the agenda (3:00–5:00 starts)', () => {
    expect(upcomingSlot(at(2, 55))).toBeNull();
    expect(upcomingSlot(at(4, 55))).toBeNull();
    // 5:55 -> 6:00 is the first agenda slot again.
    expect(upcomingSlot(at(5, 55))?.slot).toBe(6);
  });
});

describe('itemsDueForSlot', () => {
  it('keeps only unfinished items pinned to the slot', () => {
    const item = (overrides: Partial<CheckItem>): CheckItem => ({
      id: 'x',
      text: 'task',
      done: false,
      order: 0,
      ...overrides,
    });
    const entry: DayEntry = {
      date: '2026-06-11',
      agenda: {},
      checkItems: [
        item({ id: 'a', slot: 15 }),
        item({ id: 'b', slot: 15, done: true }),
        item({ id: 'c', slot: 16 }),
        item({ id: 'd' }), // slot-less: never reminded
      ],
    };
    expect(itemsDueForSlot(entry, 15).map((i) => i.id)).toEqual(['a']);
  });
});
