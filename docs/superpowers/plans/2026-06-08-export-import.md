# Export / Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add export-to-file and import-from-file buttons to the Today extension so users can back up and restore their daily notes.

**Architecture:** Two pure functions (`exportAll`, `importDays`) are added to the existing `db.ts` module. A new `ImportExport` React component renders two small icon buttons and a hidden file input; it lives in the bottom-left toolbar alongside the existing `SyncStatus` and `ConnectButton` components. No server changes are needed.

**Tech Stack:** TypeScript, React 19, Dexie 4 (IndexedDB), Tailwind CSS v4, WXT (browser extension framework), Bun

---

### Task 1: Add `exportAll` and `importDays` to `db.ts`

**Files:**
- Modify: `entrypoints/newtab/lib/db.ts`

---

- [ ] **Step 1: Add the export/import types and `exportAll` function**

Open `entrypoints/newtab/lib/db.ts` and append the following after the existing `saveDay` export:

```typescript
export interface ExportEnvelope {
  version: 1;
  exportedAt: string;
  days: Record<string, DayEntry>;
}

/**
 * Serialise all IndexedDB rows into a versioned envelope and trigger a
 * browser file download named `today-export-YYYY-MM-DD.json`.
 */
export async function exportAll(): Promise<void> {
  const all = await db.days.toArray();
  const days: Record<string, DayEntry> = {};
  for (const entry of all) {
    days[entry.date] = entry;
  }
  const envelope: ExportEnvelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    days,
  };
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `today-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Add the `importDays` function**

Still in `entrypoints/newtab/lib/db.ts`, append after `exportAll`:

```typescript
/**
 * Parse a File as an ExportEnvelope, validate it, and merge new days into
 * IndexedDB (existing days win — we never overwrite). For each imported day,
 * optionally push to the server via `serverPut`.
 * Returns { imported, skipped } counts.
 */
export async function importDays(
  file: File,
  serverPut?: (entry: DayEntry) => Promise<void>,
): Promise<{ imported: number; skipped: number }> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid file — could not parse JSON.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as ExportEnvelope).version !== 1 ||
    typeof (parsed as ExportEnvelope).days !== 'object'
  ) {
    throw new Error('Unrecognised format — missing version or days.');
  }

  const { days } = parsed as ExportEnvelope;
  let imported = 0;
  let skipped = 0;

  for (const [date, entry] of Object.entries(days)) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof entry.date !== 'string' ||
      !Array.isArray(entry.checkItems) ||
      typeof entry.agenda !== 'object'
    ) {
      // Malformed entry — skip silently.
      skipped++;
      continue;
    }
    const existing = await db.days.get(date);
    if (existing) {
      skipped++;
      continue;
    }
    await db.days.put(entry as DayEntry);
    if (serverPut) {
      try {
        await serverPut(entry as DayEntry);
      } catch {
        // Server push is best-effort; data is safe in IndexedDB.
      }
    }
    imported++;
  }

  return { imported, skipped };
}
```

- [ ] **Step 3: Type-check**

```bash
bun run compile
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add entrypoints/newtab/lib/db.ts
git commit -m "feat: add exportAll and importDays to db"
```

---

### Task 2: Create the `ImportExport` component

**Files:**
- Create: `entrypoints/newtab/components/ImportExport.tsx`

---

- [ ] **Step 1: Create the component file**

Create `entrypoints/newtab/components/ImportExport.tsx` with this content:

```tsx
import { useRef, useState } from 'react';
import { exportAll, importDays } from '../lib/db';
import { putDay } from '../lib/api';

type Status = { ok: boolean; message: string } | null;

export function ImportExport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (ok: boolean, message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus({ ok, message });
    timerRef.current = setTimeout(() => setStatus(null), 3000);
  };

  const handleExport = async () => {
    try {
      await exportAll();
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
```

- [ ] **Step 2: Type-check**

```bash
bun run compile
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add entrypoints/newtab/components/ImportExport.tsx
git commit -m "feat: add ImportExport component"
```

---

### Task 3: Wire `ImportExport` into `App.tsx`

**Files:**
- Modify: `entrypoints/newtab/App.tsx`

---

- [ ] **Step 1: Import and add `ImportExport` to the toolbar**

In `entrypoints/newtab/App.tsx`, add the import at the top:

```tsx
import { ImportExport } from './components/ImportExport';
```

Then find the bottom-left toolbar div:

```tsx
<div className="fixed bottom-4 left-4 z-10 flex items-center gap-2">
  <SyncStatus online={online} />
  <ConnectButton />
</div>
```

And replace it with:

```tsx
<div className="fixed bottom-4 left-4 z-10 flex items-center gap-2">
  <SyncStatus online={online} />
  <ConnectButton />
  <ImportExport />
</div>
```

- [ ] **Step 2: Type-check and build**

```bash
bun run compile && bun run build
```

Expected: no errors, build succeeds.

- [ ] **Step 3: Manual smoke test**

1. Load the built extension from `.output/chrome-mv3/` in Chrome (chrome://extensions → Load unpacked).
2. Open a new tab. Verify two small icon buttons appear in the bottom-left toolbar.
3. Click the export button (↓). A file `today-export-YYYY-MM-DD.json` should download with the correct envelope shape.
4. Delete one day from IndexedDB (via DevTools → Application → IndexedDB → today → days).
5. Click import (↑), select the exported file. Status message should read "Imported 1 day, skipped N".
6. Reload the tab — the re-imported day's data should appear.
7. Import the same file again. Status should say "Nothing new — N days already exist".

- [ ] **Step 4: Commit**

```bash
git add entrypoints/newtab/App.tsx
git commit -m "feat: wire ImportExport into toolbar"
```
