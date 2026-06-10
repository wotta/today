import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DayEntry } from '../entrypoints/newtab/lib/types';

const h = vi.hoisted(() => ({
  entry: null as DayEntry | null,
  update: vi.fn(),
}));

vi.mock('../entrypoints/newtab/lib/useDay', () => ({
  useDay: () => ({ entry: h.entry, update: h.update, online: true, loading: false }),
}));

import { NotePage } from '../entrypoints/newtab/components/NotePage';

function day(over: Partial<DayEntry> = {}): DayEntry {
  return { date: '2026-06-10', checkItems: [], agenda: {}, ...over };
}

describe('NotePage editor', () => {
  it('shows the existing note source in the live editor', () => {
    h.entry = day({ note: '# Plan\n**bold** move' });
    render(<NotePage date="2026-06-10" />);

    const editor = screen.getByRole('textbox', { name: 'Notes for 2026-06-10' });
    // Styled source: the markdown marks stay visible in the document.
    expect(editor.textContent).toContain('# Plan');
    expect(editor.textContent).toContain('**bold** move');
  });

  it('labels a slot note with its hour', () => {
    h.entry = day({ slotNotes: { 14: 'dentist notes' } });
    render(<NotePage date="2026-06-10" hour={14} />);

    const editor = screen.getByRole('textbox', { name: 'Notes for 2026-06-10 at 14:00' });
    expect(editor.textContent).toContain('dentist notes');
  });

  it('shows slot context (agenda text + pinned todos) in the rail', async () => {
    h.entry = day({
      slotNotes: { 14: 'dentist notes' },
      agenda: { 14: 'Dentist appointment' },
      checkItems: [{ id: 'a', text: 'Bring x-rays', done: false, order: 0, slot: 14 }],
    });
    render(<NotePage date="2026-06-10" hour={14} />);

    await userEvent.click(screen.getByRole('button', { name: 'Show context' }));

    expect(screen.getByText('Dentist appointment')).toBeInTheDocument();
    expect(screen.getByText(/Bring x-rays/)).toBeInTheDocument();
  });
});
