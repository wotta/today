import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  exportAll: vi.fn<(days?: unknown) => Promise<void>>(),
  importDays: vi.fn<() => Promise<{ imported: number; skipped: number }>>(),
  fetchAllDays: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('../entrypoints/newtab/lib/db', () => ({
  exportAll: (days?: unknown) => h.exportAll(days),
  importDays: () => h.importDays(),
}));
vi.mock('../entrypoints/newtab/lib/backend', () => ({
  putDay: vi.fn(),
  fetchAllDays: () => h.fetchAllDays(),
}));

import { ImportExport } from '../entrypoints/newtab/components/ImportExport';

beforeEach(() => {
  h.exportAll.mockReset().mockResolvedValue(undefined);
  h.importDays.mockReset().mockResolvedValue({ imported: 0, skipped: 0 });
  h.fetchAllDays.mockReset().mockResolvedValue({});
});

function uploadFile() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['{}'], 'import.json', { type: 'application/json' });
  return userEvent.upload(input, file);
}

describe('export', () => {
  it('exports the backend data (source of truth) when reachable', async () => {
    const fromServer = { '2026-06-10': { date: '2026-06-10', checkItems: [], agenda: { 9: 'x' } } };
    h.fetchAllDays.mockResolvedValue(fromServer);
    const user = userEvent.setup();
    render(<ImportExport />);

    await user.click(screen.getByTitle('Export all days to JSON'));

    expect(h.exportAll).toHaveBeenCalledWith(fromServer);
    expect(await screen.findByText('Exported')).toBeInTheDocument();
  });

  it('falls back to the local cache when the backend is unreachable', async () => {
    h.fetchAllDays.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<ImportExport />);

    await user.click(screen.getByTitle('Export all days to JSON'));

    expect(h.exportAll).toHaveBeenCalledWith(undefined);
    expect(await screen.findByText('Exported (local cache)')).toBeInTheDocument();
  });

  it('flashes "Export failed" when exportAll throws', async () => {
    h.exportAll.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<ImportExport />);

    await user.click(screen.getByTitle('Export all days to JSON'));

    expect(await screen.findByText('Export failed')).toBeInTheDocument();
  });
});

describe('import', () => {
  it('reports how many days were imported and skipped', async () => {
    h.importDays.mockResolvedValue({ imported: 2, skipped: 1 });
    render(<ImportExport />);

    await uploadFile();

    expect(await screen.findByText('Imported 2 days, skipped 1')).toBeInTheDocument();
  });

  it('says "Nothing new" when every day already exists', async () => {
    h.importDays.mockResolvedValue({ imported: 0, skipped: 3 });
    render(<ImportExport />);

    await uploadFile();

    expect(await screen.findByText(/Nothing new — 3 days already exist/)).toBeInTheDocument();
  });

  it('surfaces the error message from a rejected import', async () => {
    h.importDays.mockRejectedValue(new Error('Unrecognised format'));
    render(<ImportExport />);

    await uploadFile();

    expect(await screen.findByText('Unrecognised format')).toBeInTheDocument();
  });
});

describe('flash lifecycle', () => {
  it('clears the message after 3 seconds', async () => {
    const user = userEvent.setup();
    render(<ImportExport />);

    await user.click(screen.getByTitle('Export all days to JSON'));
    const flash = await screen.findByText('Exported');

    // The flash uses a 3s setTimeout; give waitFor a little headroom.
    await waitForElementToBeRemoved(flash, { timeout: 4000 });
  });
});
