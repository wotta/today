# Mobile App — Implementation Plan (bare-basics)

Status: draft · Date: 2026-06-20 · App: `apps/mobile` (NativePHP + Laravel) · Refs #19, #7

Goal: bring the **core** Today experience to the NativePHP mobile app — a planner
that looks and feels like the browser extension, syncs to the same GitHub Gist,
and lets the user pick light / dark / auto. Deliberately a thin first slice.

---

## 1. Scope

**In**
- Date header: long date, prev/next day, "today" jump, weekday strip (S M T W T F S).
- Checklist ("Check"): add, toggle done, edit text inline, delete. Sorted by `order`.
- Agenda: hours 6:00 → 26:00, one editable free-text line per hour, "now" highlight.
- Settings screen: **theme (light / dark / auto)**, **GitHub Gist linking** (PAT + Gist ID, save / disconnect), with the same connect logic the extension uses.
- Data persisted locally and synced to the same Gist envelope (`today-data.json`).
- Visual design matching the extension (notebook page, stone palette, amber accents), adapted to a single-column phone layout with safe-area insets and dark mode.

**Out (explicitly deferred)**
- ❌ Drag-and-drop (no checklist reorder by drag, no pin-to-agenda by drag).
- ❌ Agenda "chips" / Trello-like cards (no pinning checklist items to hours yet).
- ❌ File uploads / S3 / R2 (no object-store settings).
- ❌ Rich descriptions (BlockNote), per-item detail modal, per-slot notes, day notes page (CodeMirror).
- ❌ Reminders / local notifications (revisit after the basics land; ties to #4).
- ❌ MCP "Connect AI" button (desktop-server feature, irrelevant on mobile).
- ❌ Real-time external-change polling (manual + on-open sync first; polling later).

---

## 2. Design language (carry over from the extension)

Source of truth: `apps/extension/entrypoints/newtab/components/*` + the captured
screenshots. Reuse the **same Tailwind tokens** so the two apps read as one product.

- **Page**: centered "notebook" card. Light `bg-[#fcfcfb]`, border `stone-200`, soft shadow; dark `bg-stone-900`, border `stone-700`. On phone: full-bleed single column, card = the screen with comfortable padding (`px-5`/`px-6`), safe-area top/bottom.
- **Type**: Inter (already bundled in the extension via `assets/`); ship the same woff2 files. Headings `text-stone-700 dark:text-stone-200`, semibold, tight tracking. Body `text-[15px]`.
- **Palette**: stone greys for structure, **amber** for "now"/pinned accents, **rose-400** ring for the active weekday. Keep these exact.
- **Checklist row**: custom square checkbox (`18px`, rounded `3px`, `stone-400` border → filled `stone-700` with a white check SVG; inverted in dark). Done text → `stone-400 line-through`. Bottom border `stone-200`/`stone-700/70` per row. Trailing delete (✕) — always visible on mobile (no hover).
- **Agenda**: left hour gutter `w-14`, right-aligned `11px` tabular-nums, vertical rule. Even hours = solid `stone-300` top border + visible label; odd hours = fainter `stone-200/60` rule + blank label (half-hour feel). "Now" row = `bg-amber-50/70 dark:bg-amber-400/10`, hour label `amber-600`. Closing rule under hour 26.
- **Date header**: "DATE" eyebrow + diagonal slash, big `text-2xl` date, ‹ › nav, "Today" pill, weekday letters with the active day in a rose-400 circle. Bottom `border-b-2`.
- **Theme control**: sun / moon toggle like `ThemeToggle`, but a 3-way (light / dark / auto) since auto is now a first-class choice — likely a segmented control in Settings plus a quick toggle on the planner.

Mobile adaptations: tap targets ≥ 44px; no hover-reveal affordances (show delete/edit inline); single column (Check above Agenda, scroll); native momentum scroll; respect `env(safe-area-inset-*)`.

---

## 3. Architecture

```
apps/mobile/
├── app/
│   ├── Domain/                 # thin Laravel-side glue over today/core
│   │   ├── DayRepository.php   # load/save Day (local SQLite) + sync hook
│   │   └── GistClient.php      # GitHub Gist read/modify/write (PHP port of gist.ts)
│   ├── Http/Controllers/
│   │   ├── PlannerController.php   # GET / (day view), day navigation
│   │   ├── DayApiController.php    # JSON endpoints the WebView JS calls to persist edits
│   │   └── SettingsController.php  # theme + gist linking
│   └── Models/DayRecord.php    # eloquent: date (pk), payload json, updated_at
├── packages dep: today/core    # Day, CheckItem, AgendaSlot (already wired)
├── resources/
│   ├── views/
│   │   ├── layouts/app.blade.php
│   │   ├── planner.blade.php    # date header + checklist + agenda
│   │   └── settings.blade.php   # theme + gist
│   ├── js/                      # light vanilla/Alpine for inline edits + theme
│   └── css/app.css              # Tailwind v4 + shared tokens
├── routes/web.php
└── database/migrations/*_create_day_records_table.php
```

**Rendering choice — Blade + a sprinkle of JS (Alpine), not React.**
The extension's React/`@today/ui` is coupled to `chrome.storage` and the extension
runtime; porting it now is out of scope (see #19 notes). Blade keeps the first slice
small and is what the WebView loads. Interactions that must feel instant (toggle a
checkbox, edit a line) update the DOM optimistically via Alpine and POST to a small
JSON API; the server persists to SQLite and (if linked) the Gist. We revisit a shared
React UI when a second JS consumer justifies extracting `@today/ui`.

**Data flow**
1. `GET /` → `PlannerController` loads the `Day` for the date (local SQLite via `DayRepository`, falling back to `Day::empty`), renders `planner.blade.php`.
2. User edits → Alpine optimistic DOM update → `POST /api/day/{date}` with the mutated `DayEntry` JSON.
3. `DayApiController` validates, maps to `today/core` `Day`, saves locally, and (if Gist linked) does a read-modify-write to the Gist.
4. On app open / pull-to-refresh → fetch the Gist, merge, update local. (Conflict handling = last-writer-wins for now, matching the extension's current behaviour; see #11.)

---

## 4. Data model & storage

- **Wire format = identical to the extension.** Gist holds `today-data.json`:
  `{ "version": 1, "exportedAt": ISO, "days": { "YYYY-MM-DD": DayEntry } }`.
  `DayEntry` = `today/core` `Day::toArray()` (date, checkItems[], agenda{hour→text}, optional note/slotNotes — we only write the fields we use).
- **Local store**: SQLite table `day_records(date PK, payload JSON, updated_at)`. `DayRepository` (de)serialises `payload` ↔ `today/core\Day`. Single source for offline use.
- **today/core already models this** — `Day::fromArray` normalises string→int hour keys; reuse it verbatim so extension-written data loads cleanly.

---

## 5. Feature breakdown & build order

### Phase A — Shell, theme, design tokens
1. Add Tailwind v4 + Vite to `apps/mobile` (mirror the extension's `@tailwindcss/vite` setup); copy the Inter woff2 assets and base CSS.
2. `layouts/app.blade.php`: safe-area scaffold, `<html>` theme class wiring, color-scheme.
3. Theme: `light | dark | auto`, persisted (NativePHP secure/key-value store, fallback `localStorage`). `auto` follows `prefers-color-scheme` live via a `matchMedia` listener; explicit choice toggles a `dark` class on `<html>`. Quick toggle on planner + segmented control in Settings.
   - Note: the extension only stores `light|dark` (defaults to system until chosen). Mobile **adds explicit `auto`** per the requirement — small superset, document it.

### Phase B — Planner read view
4. `DayRecord` model + migration; `DayRepository`.
5. `PlannerController@show` + `planner.blade.php`: date header, Check list, Agenda — all rendered from a `today/core` `Day`. Day navigation (prev/next/today) via query param or route (`/?date=YYYY-MM-DD`).

### Phase C — Editing (local persistence)
6. `DayApiController` + `POST /api/day/{date}` (validate with a Laravel FormRequest mirroring `DayEntrySchema`'s rules: date regex, hour 6–26).
7. Alpine interactions: add task (Enter), toggle done, edit text (blur/debounce), delete; edit agenda hour text. Optimistic UI, then POST. No drag, no pinning.

### Phase D — Gist sync
8. `GistClient` (PHP port of `gist.ts`): `findGistWithData`, `createGist`, `verifyGist`, `load`, `save` against `https://api.github.com` with `Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`. Read-modify-write on save (re-read days, splice the one date, PATCH) so we don't clobber MCP/extension writes.
9. PAT storage: **NativePHP secure storage** (Keychain / Keystore), never in plain prefs. Gist ID alongside.
10. Wire `DayApiController` save → after local write, if linked, push to Gist. On app open / pull-to-refresh → `load` + update local.

### Phase E — Settings screen
11. `settings.blade.php` + `SettingsController`: theme segmented control; Gist form (PAT password field, optional Gist ID, "Save" → verify/find/create like `OptionsApp.save`, "Disconnect" → clear). Status line (connecting / connected: `<gistId>` / typed errors mirroring `messageFor`: bad token, gist not found, rate-limited, offline). Link to GitHub's new-token URL with `scope=gist` prefilled.

---

## 6. Gist linking — parity with the extension

Reuse the extension's exact logic (`OptionsApp.save`):
- If a Gist ID is given → `verifyGist(pat, id)`; else `findGistWithData(pat)` (reuse an existing `today-data.json` gist so a second device doesn't spawn a duplicate) `?? createGist(pat)`.
- Persist `{pat, gistId}`. Same envelope, same `GIST_FILE = 'today-data.json'`, same `version: 1`. Result: extension and mobile share one Gist transparently.

---

## 7. Files to create (summary)

- `apps/mobile/app/Models/DayRecord.php`
- `apps/mobile/app/Domain/{DayRepository,GistClient}.php`
- `apps/mobile/app/Http/Controllers/{PlannerController,DayApiController,SettingsController}.php`
- `apps/mobile/app/Http/Requests/SaveDayRequest.php`
- `apps/mobile/database/migrations/xxxx_create_day_records_table.php`
- `apps/mobile/resources/views/layouts/app.blade.php`
- `apps/mobile/resources/views/{planner,settings}.blade.php`
- `apps/mobile/resources/css/app.css`, `apps/mobile/resources/js/{planner,theme}.js`
- `apps/mobile/routes/web.php` (replace demo route), Tailwind/Vite config + Inter assets.

---

## 8. Verification

- Local: `php artisan serve`, hit `/` and `/settings`, exercise add/toggle/edit/delete + theme switch in a browser; confirm SQLite round-trips via `today/core`.
- Gist: link a real PAT in a throwaway gist, edit on mobile, confirm the extension sees it (and vice-versa).
- On device: `php artisan native:jump --ip=<tailscale>` (see memory `nativephp-jump-wsl-ios`), verify layout, safe-areas, dark mode, tap targets on the iPhone.

---

## 9. Open questions

1. **Conflict resolution**: keep extension-parity last-writer-wins, or do per-field merge? (Issue #11 already tracks this for the extension; mobile can inherit whatever lands there.)
2. **Auto theme in NativePHP WebView**: confirm `prefers-color-scheme` reflects the iOS system setting live; if not, read it via a NativePHP system API.
3. **Secure storage API**: confirm the exact NativePHP facade for Keychain/Keystore for the PAT.
4. **Offline-first**: assume yes — local SQLite is the source, Gist is a sync target. Agreed?
