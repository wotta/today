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
  it('typesets an existing note as markdown and switches to a textarea on click', async () => {
    h.entry = day({ note: '# Plan\n**bold** move' });
    render(<NotePage date="2026-06-10" />);

    // Rendered view: markdown is typeset, no marks visible.
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /click to edit/i }));

    // Edit view: the raw source in a textarea.
    expect(screen.getByRole('textbox')).toHaveValue('# Plan\n**bold** move');
  });

  it('starts in edit mode when the note is empty', () => {
    h.entry = day();
    render(<NotePage date="2026-06-10" />);

    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('escapes raw HTML in the typeset view', () => {
    h.entry = day({ note: '<img src=x onerror=alert(1)>' });
    const { container } = render(<NotePage date="2026-06-10" />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('shows slot context (agenda text + pinned todos) in the rail', async () => {
    h.entry = day({
      note: undefined,
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
