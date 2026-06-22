import { describe, expect, it } from 'vitest';
import { hourLabel } from '../entrypoints/newtab/lib/date';

describe('hourLabel', () => {
  it('formats whole hours on the hour', () => {
    expect(hourLabel(14)).toBe('14:00');
    // Late-night planner hours stay 24/25/26 rather than wrapping.
    expect(hourLabel(26)).toBe('26:00');
  });

  it('formats fractional hours as minutes', () => {
    expect(hourLabel(14.25)).toBe('14:15');
    expect(hourLabel(14.5)).toBe('14:30');
    expect(hourLabel(14.75)).toBe('14:45');
  });
});
