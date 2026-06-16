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
