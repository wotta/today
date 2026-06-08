# Export / Import — Design Spec

**Date:** 2026-06-08
**Status:** Approved

---

## Overview

Add export and import functionality to the Today browser extension so users can back up their data, restore it, or move it to a new machine. All logic runs in the extension; no server changes are required.

---

## Data Format

Exports use a versioned JSON envelope:

```json
{
  "version": 1,
  "exportedAt": "2026-06-08T14:00:00.000Z",
  "days": {
    "2026-06-08": {
      "date": "2026-06-08",
      "checkItems": [...],
      "agenda": {}
    }
  }
}
```

The `days` value is the same `Record<string, DayEntry>` shape already used by the server's `data.json`, so the formats are compatible.

---

## Export

1. Read all rows from IndexedDB via `db.days.toArray()`.
2. Build the envelope with `version: 1` and `exportedAt: new Date().toISOString()`.
3. Serialize to JSON and trigger a browser download as `today-export-YYYY-MM-DD.json` (date = today).
4. No confirmation dialog needed — export is non-destructive.

---

## Import

1. User clicks the Import button; a hidden `<input type="file" accept=".json">` is programmatically clicked.
2. Parse the selected file and validate:
   - Must be valid JSON.
   - Must have `version === 1` and a `days` object.
   - Each entry must have a `date` string, `checkItems` array, and `agenda` object.
   - Invalid files show an error message; import is aborted.
3. Merge strategy — **existing days win**: for each day in the import, skip it if a record for that date already exists in IndexedDB; otherwise write it.
4. If the server is online, push all newly written days via `api.putDay` (best-effort; failures are silently ignored since the server will sync on reconnect).
5. Return `{ imported: number, skipped: number }` for the status message.

---

## Components & Files

| File | Change |
|------|--------|
| `entrypoints/newtab/lib/db.ts` | Add `exportAll()` and `importDays(file: File)` functions |
| `entrypoints/newtab/components/ImportExport.tsx` | New component — two icon buttons + hidden file input + status message |
| `entrypoints/newtab/App.tsx` | Add `<ImportExport>` to the bottom-left toolbar |

### `exportAll(): Promise<void>`
Reads all days from IndexedDB, builds the envelope, and triggers a file download. Returns void.

### `importDays(file: File, onlinePutDay?: (entry: DayEntry) => Promise<void>): Promise<{ imported: number; skipped: number }>`
Parses, validates, merges into IndexedDB, optionally pushes to server, returns counts.

### `ImportExport` component
- Two small icon buttons (↓ export, ↑ import) matching the style of existing toolbar buttons.
- Hidden `<input type="file" accept=".json">` triggered on import click.
- `status` state: `null | { ok: boolean; message: string }` — renders a small inline label that clears after 3 seconds via `setTimeout`.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| File is not valid JSON | Show "Invalid file" error message |
| File missing `version` or `days` | Show "Unrecognised format" error message |
| Individual day entry malformed | Skip that entry, continue with valid ones |
| IndexedDB write fails | Show "Import failed" error message |
| Server push fails | Silently ignored — data is safe in IndexedDB |

---

## Out of Scope

- Export to Markdown
- Selective export (date range picker)
- Import with "imported days win" or "replace all" strategies
- Server-side export/import endpoints
