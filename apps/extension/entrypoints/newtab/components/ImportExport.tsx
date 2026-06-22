import { useEffect, useRef, useState } from 'react';
import { exportAll, importDays } from '../lib/db';
import { fetchAllDays, putDay } from '../lib/backend';
import type { DayEntry } from '@today/types';

type Status = { ok: boolean; message: string } | null;

export function ImportExport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const flash = (ok: boolean, message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ ok, message });
    timerRef.current = setTimeout(() => setStatus(null), 3000);
  };

  const handleExport = async () => {
    try {
      // Prefer the connected backend (source of truth); the IndexedDB cache
      // only holds days this browser has visited.
      let days: Record<string, DayEntry> | undefined;
      try {
        days = await fetchAllDays();
      } catch {
        days = undefined; // backend unreachable — export the local cache
      }
      await exportAll(days);
      flash(true, days ? 'Exported' : 'Exported (local cache)');
    } catch {
      flash(false, 'Export failed');
    }
  };

  const handleImportClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-imported after a fix.
    e.target.value = '';
    try {
      const { imported, skipped } = await importDays(file, putDay);
      flash(
        true,
        imported === 0
          ? `Nothing new — ${skipped} day${skipped !== 1 ? 's' : ''} already exist`
          : `Imported ${imported} day${imported !== 1 ? 's' : ''}${skipped ? `, skipped ${skipped}` : ''}`,
      );
    } catch (err) {
      flash(false, err instanceof Error ? err.message : 'Import failed');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        title="Export all days to JSON"
        onClick={handleExport}
        className="flex items-center rounded-full border border-stone-200 bg-white/80 p-1.5 text-stone-400 shadow-sm backdrop-blur transition-colors hover:text-stone-800 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-500 dark:hover:text-stone-100"
      >
        <ExportIcon />
      </button>

      <button
        type="button"
        title="Import days from JSON"
        onClick={handleImportClick}
        className="flex items-center rounded-full border border-stone-200 bg-white/80 p-1.5 text-stone-400 shadow-sm backdrop-blur transition-colors hover:text-stone-800 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-500 dark:hover:text-stone-100"
      >
        <ImportIcon />
      </button>

      {status && (
        <span
          className={`text-[11px] font-medium ${status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}
        >
          {status.message}
        </span>
      )}
    </div>
  );
}

function ExportIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
