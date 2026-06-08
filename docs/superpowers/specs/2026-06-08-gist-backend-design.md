# GitHub Gist Storage Backend — Design Spec

**Date:** 2026-06-08
**Status:** Approved

---

## Overview

Add an experimental GitHub Gist storage backend to the Today browser extension. When a GitHub Personal Access Token (PAT) is configured, the extension syncs all daily data to a single private GitHub Gist instead of the local helper server. IndexedDB continues to serve as the offline cache. The local server becomes optional once Gist is configured.

---

## Auth

**Method:** Personal Access Token (PAT) only. No OAuth.

The PAT requires the `gist` scope only. It is stored in `chrome.storage.local` — sandboxed to the extension, never synced to Google servers, no encryption needed.

---

## Gist Format

One private Gist, one file (`today-data.json`), using the same versioned envelope as the existing export format:

```json
{
  "version": 1,
  "exportedAt": "2026-06-08T14:00:00.000Z",
  "days": {
    "2026-06-08": { "date": "2026-06-08", "checkItems": [...], "agenda": {} }
  }
}
```

Every write serialises the full `days` object and PATCHes the Gist. This is simple, human-readable, and compatible with the existing export/import feature.

---

## Settings Flow

1. User opens the Options page (right-click extension icon → Options).
2. User pastes PAT into the password field and optionally pastes an existing Gist ID (for multi-device use).
3. On Save:
   - Validate PAT by calling `GET https://api.github.com/gists` (confirms `gist` scope without touching data).
   - If no Gist ID provided: create a new private Gist with `today-data.json` set to `{"version":1,"days":{}}` and store the returned ID.
   - If Gist ID provided: fetch the Gist to verify it exists and is accessible.
   - Persist `{ pat, gistId }` to `chrome.storage.local`.
4. Status line shows "Connected — gist: `<id>`".
5. Disconnect button clears PAT and Gist ID from storage, reverting to local server.

---

## Unified Backend Interface

`useDay.ts` changes one import line. Everything else is unchanged.

```
import * as api from './api'
→
import * as api from './backend'
```

`backend.ts` reads `GistConfig` from `chrome.storage.local` lazily (on the first call) and caches the result for the session. It delegates all calls to either `api.ts` (local server) or `gist.ts` (GitHub) based on whether a valid config exists.

Both `api.ts` and `gist.ts` export the same four functions:

```ts
fetchDay(date: string): Promise<DayEntry>
putDay(entry: DayEntry): Promise<void>
beaconDay(entry: DayEntry): void          // no-op in gist.ts
subscribe(
  onChange: (change: RemoteChange) => void,
  onConnection: (online: boolean) => void,
): () => void                             // calls onConnection(true) immediately, no live feed
```

`gist.ts` caches the full `days` object in memory between calls so `fetchDay` for an already-loaded date does not hit the network again within the same session.

---

## Files

| File | Change |
|------|--------|
| `entrypoints/newtab/lib/backend.ts` | **New** — selects `api.ts` or `gist.ts` based on `GistConfig` |
| `entrypoints/newtab/lib/gist.ts` | **New** — Gist implementation of the shared backend interface |
| `entrypoints/newtab/lib/settings.ts` | **New** — typed read/write of `GistConfig` in `chrome.storage.local` |
| `entrypoints/newtab/lib/useDay.ts` | **1-line change** — import from `./backend` instead of `./api` |
| `entrypoints/newtab/components/SyncStatus.tsx` | **Minor** — accept optional `label` prop so it can show "Gist" when Gist backend is active |
| `entrypoints/options/index.html` | **New** — WXT options page entry point |
| `entrypoints/options/main.tsx` | **New** — React root for options page |
| `entrypoints/options/OptionsApp.tsx` | **New** — settings form component |
| `wxt.config.ts` | **Update** — add `storage` permission + `https://api.github.com/*` host permission |

---

## Types

```ts
// settings.ts
export interface GistConfig {
  pat: string;
  gistId: string;
}

// Returns null if unconfigured or fields are missing/empty.
export async function getGistConfig(): Promise<GistConfig | null>
export async function setGistConfig(config: GistConfig): Promise<void>
export async function clearGistConfig(): Promise<void>
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Invalid PAT on settings save | Show "Invalid token — check the PAT has gist scope" |
| Gist not found (deleted externally) | Show "Gist not found" in status; disable Gist backend until reconfigured |
| GitHub API rate-limited or unreachable | Fall back to IndexedDB cache; show amber "Gist offline" indicator |
| Gist write fails | Save to IndexedDB; retry on next `putDay` call |
| First load with Gist configured | Fetch full Gist file; hydrate all days into IndexedDB; return requested day |
| Config present but Gist ID missing | Treat as misconfigured; fall back to local server; show warning in status |
| PAT cleared mid-session | On next `putDay`, route to local server silently |

---

## Test Suite

### Setup

Install as dev dependencies:
- `vitest` — test runner (Vite-native, no separate bundler config)
- `@vitest/coverage-v8` — coverage reports
- `fake-indexeddb` — in-memory Dexie backend for `db.ts` tests
- `msw` — intercepts `fetch` for local server and GitHub API mocks
- `@testing-library/react` + `@testing-library/user-event` — component tests
- `jsdom` — DOM environment for React tests

Add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

Add `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

### Baseline Coverage (existing logic)

#### `db.ts`
- `emptyDay(date)` returns `{ date, checkItems: [], agenda: {} }`
- `getDay` returns `emptyDay` when no record exists
- `getDay` returns the stored record when one exists
- `saveDay` persists a day that has content
- `saveDay` deletes a day that has no content (lazy cleanup)
- `exportAll` returns a valid `ExportEnvelope` with `version: 1`, `exportedAt`, and all stored days
- `importDays` imports days not in IndexedDB, skips days that already exist
- `importDays` throws `"Invalid file"` on non-JSON input
- `importDays` throws `"Unrecognised format"` when envelope is missing `version` or `days`
- `importDays` skips malformed individual day entries without aborting
- `importDays` calls `serverPut` for each successfully imported day
- `importDays` silently ignores `serverPut` failures

#### `api.ts`
- `fetchDay` returns parsed `DayEntry` on 200
- `fetchDay` throws on non-200 response
- `putDay` sends a PUT with `Content-Type: application/json` and `X-Today-Client` header
- `putDay` throws on non-200 response
- `subscribe` calls `onConnection(true)` when EventSource opens
- `subscribe` calls `onConnection(false)` on EventSource error
- `subscribe` retries up to `MAX_RETRIES` times then stops
- `subscribe` returns an unsubscribe function that closes the EventSource

#### `useDay.ts`
- Loads from server on mount; falls back to IndexedDB on server error
- Debounces saves (does not call `persist` on every keystroke)
- On reconnect with no pending edits: pulls from server (not pushes)
- On reconnect with pending edits: pushes local edits to server
- Ignores server change events that match `CLIENT_ID` (own writes)
- Ignores server change events for other dates

#### `ImportExport.tsx`
- Export button calls `exportAll` and shows "Exported" flash
- Export button shows "Export failed" flash on error
- Import button opens file picker
- Import shows correct success message for N imported / M skipped
- Import shows "Nothing new" when all days already exist
- Import shows error message string from thrown `Error`
- Flash message clears after 3 seconds

### New Feature Coverage

#### `settings.ts`
- `getGistConfig` returns `null` when storage is empty
- `getGistConfig` returns `null` when PAT or Gist ID is missing/empty
- `getGistConfig` returns `GistConfig` when both fields are present
- `setGistConfig` persists PAT and Gist ID to `chrome.storage.local`
- `clearGistConfig` removes PAT and Gist ID from storage

#### `gist.ts`
- `fetchDay` parses `today-data.json` from Gist and returns the requested day
- `fetchDay` returns `emptyDay` when date not present in Gist
- `fetchDay` uses in-memory cache on second call (no second network request)
- `putDay` PATCHes the Gist with the updated `days` object
- `subscribe` calls `onConnection(true)` immediately and returns a no-op unsubscribe
- `beaconDay` is a no-op (does not throw)
- Throws a typed error on 401 (invalid PAT)
- Throws a typed error on 404 (Gist not found)
- Handles 429 (rate limit) by throwing so caller can fall back to cache

#### `backend.ts`
- Routes to `api.ts` when `getGistConfig` returns `null`
- Routes to `gist.ts` when `getGistConfig` returns a valid config
- Passes `GistConfig` through to `gist.ts` calls

#### `OptionsApp.tsx`
- Renders PAT input and optional Gist ID input
- Save button is disabled when PAT field is empty
- Shows "Connecting…" state while validating
- Shows "Connected — gist: `<id>`" on success
- Shows error message on invalid PAT
- Disconnect button calls `clearGistConfig` and resets form
- Pre-fills form fields from existing `GistConfig` on load

---

## Out of Scope

- GitHub OAuth / social login
- Per-day Gist files
- Conflict resolution for simultaneous multi-device edits
- Live change feed from Gist (no push mechanism available)
- Encryption of the PAT at rest
