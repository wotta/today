import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayEntry } from '@today/types';
import { todayKey } from '../entrypoints/newtab/lib/date';

/**
 * Behavior tests: the note page is actually reachable from the planner.
 * The data layer (useDay) and backend probes are mocked; routing, the hash,
 * and the page switch are the real implementation.
 */

const h = vi.hoisted(() => ({
  entry: null as DayEntry | null,
}));

vi.mock('../entrypoints/newtab/lib/useDay', () => ({
  useDay: () => ({ entry: h.entry, update: vi.fn(), online: true, loading: false, lastSaved: null }),
}));
vi.mock('../entrypoints/newtab/lib/backend', () => ({
  isGistActive: () => Promise.resolve(false),
}));
vi.mock('../entrypoints/newtab/lib/settings', () => ({
  getAgendaSlotMinutes: () => Promise.resolve(60),
}));

import App from '../entrypoints/newtab/App';

beforeEach(() => {
  window.history.replaceState(null, '', '#/');
  h.entry = { date: todayKey(), checkItems: [], agenda: {} };
});

describe('reaching the note page from the planner', () => {
  it('opens the day note via the page-corner ✎', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: `Open notes for ${todayKey()}` }));

    // The note page is showing: back affordance + the (empty → editing) note.
    expect(await screen.findByRole('button', { name: 'Back to planner' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: new RegExp(`Notes for ${todayKey()}$`) })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/note/${todayKey()}`);
  });

  it('opens an hour note via the agenda row ✎', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Open notes for 14:00' }));

    expect(await screen.findByRole('button', { name: 'Back to planner' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /at 14:00$/ })).toBeInTheDocument();
    expect(window.location.hash).toBe(`#/note/${todayKey()}/14`);
  });

  it('returns to the planner from the note page', async () => {
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: `Open notes for ${todayKey()}` }));
    await screen.findByRole('button', { name: 'Back to planner' });

    await userEvent.click(screen.getByRole('button', { name: 'Back to planner' }));

    // Planner content is back.
    expect(await screen.findByRole('heading', { name: 'Check' })).toBeInTheDocument();
  });
});
