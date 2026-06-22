// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CheckItemSchema, DayEntrySchema } from '../server/types';

describe('CheckItem description', () => {
  it('keeps a description through a schema round-trip', () => {
    const parsed = CheckItemSchema.parse({
      id: 'a',
      text: 'Ticket aanmaken voor EA settings pagina',
      done: false,
      order: 0,
      description: 'Die kan kapot gaan als er een nieuwe setting is waar geen enum voor is.',
    });
    expect(parsed.description).toBe(
      'Die kan kapot gaan als er een nieuwe setting is waar geen enum voor is.',
    );
  });

  it('leaves description absent when not provided', () => {
    const parsed = CheckItemSchema.parse({ id: 'a', text: 'task', done: false, order: 0 });
    expect(parsed).not.toHaveProperty('description');
  });

  it('survives a full DayEntry round-trip (the server save boundary)', () => {
    const parsed = DayEntrySchema.parse({
      date: '2026-06-16',
      checkItems: [
        { id: 'a', text: 'title', done: false, order: 0, description: 'long detail' },
      ],
      agenda: {},
    });
    expect(parsed.checkItems[0].description).toBe('long detail');
  });
});

describe('CheckItem slot', () => {
  const base = { id: 'a', text: 'task', done: false, order: 0 };

  it('accepts whole, half, and quarter-hour slots', () => {
    expect(CheckItemSchema.parse({ ...base, slot: 14 }).slot).toBe(14);
    expect(CheckItemSchema.parse({ ...base, slot: 14.5 }).slot).toBe(14.5);
    expect(CheckItemSchema.parse({ ...base, slot: 14.25 }).slot).toBe(14.25);
  });

  it('rejects slots off the 0.25-hour grid', () => {
    expect(() => CheckItemSchema.parse({ ...base, slot: 14.1 })).toThrow();
  });

  it('rejects slots outside the agenda range', () => {
    expect(() => CheckItemSchema.parse({ ...base, slot: 5 })).toThrow();
    expect(() => CheckItemSchema.parse({ ...base, slot: 27 })).toThrow();
  });
});
