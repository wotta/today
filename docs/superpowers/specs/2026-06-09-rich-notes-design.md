# Rich Notes (per-day & per-slot) — Design Spec

**Date:** 2026-06-09
**Status:** Approved
**Issue:** #5

---

## Overview

Extend the planner with longer, richer notes — a freeform note for a whole day,
and an optional expanded note attached to a specific agenda hour. Today each
agenda hour holds only a single line of text; notes give you a full writing
surface without cluttering the planner.

A note opens as a **full-screen route inside the new-tab SPA**, styled as a
"notes page" in the same notebook — a near-exact reproduction of the Japanese
*Logical Note* (ロジカルノート) ruling the planner's aesthetic already borrows
from. The planner page-turns into the note and back; no browser chrome, no new
tab, no modal.

Note content is **plain markdown**, stored as a string — mirroring how `agenda`
already stores one string per hour. The notebook look comes entirely from the
ruled CSS surface, which is independent of the content format, so a heavier rich
editor (BlockNote et al.) is explicitly **not** pursued: it would fight the
ruling and add hundreds of kB for no aesthetic gain.

---

## Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Note host | Full-screen route in new-tab SPA | Single calm surface we control to the pixel; extends the notebook identity instead of adding a second one. Side panel is too narrow/chrome-bound for the near-exact ruled UI and diverges across Chrome/Firefox. |
| Content format | Plain markdown string | Trivial model, rides existing sync/export/Gist/MCP unchanged, full control over the ruled aesthetic. The notebook look is pure CSS, independent of content — so BlockNote (which would fight the ruling and add hundreds of kB) is dropped entirely. |
| Scope | Per-day **and** per-slot, behind one flag | Per-slot is a superset of per-day on the same surface; flag-toggling the per-slot affordance gives the per-day-only variant with no throwaway code. |
| Aesthetic | Near-exact Logical Note, pure CSS | Layered `repeating-linear-gradient` ruling — crisp at any zoom, no image assets. |

---

## Data Model

Notes are plain markdown strings, so the whole sync/export/Gist/MCP pipeline
carries them unchanged (same property that let `slot` ride through). They sit on
`DayEntry` exactly like `agenda` — a per-day string and a per-hour string map:

```ts
interface DayEntry {
  date: string;
  checkItems: CheckItem[];
  agenda: Record<number, string>;   // unchanged — one-line hour text
  note?: string;                     // per-day freeform markdown note  (NEW)
  slotNotes?: Record<number, string>;// per-hour markdown notes, keyed like agenda  (NEW)
}
```

- **`slotNotes` is a parallel map**, not a widening of `agenda` values. This is
  non-breaking: every existing agenda read/write and all MCP agenda tools keep
  working untouched. (Widening `agenda` to `{text, note}` was considered and
  rejected for the churn it forces on the MCP surface and sync.)
- **Zod** (`server/types.ts`): add optional `note: z.string()` and
  `slotNotes: z.record(z.string(), z.string())` to `DayEntrySchema`. The server
  REST `PUT` validates the whole `DayEntry`, so this is the seam that makes notes
  persist server-side (same path that required adding `slot`).
- **`hasContent()`** (both `store.ts` and `db.ts`) gains: a day also has content
  if `note` is non-empty or any `slotNotes` entry is non-empty (trimmed). Keeps
  lazy cleanup correct.

### If rich text is ever wanted later

Not a goal, but the door isn't bolted: markdown is a clean substrate to grow
from, and because notes are just strings, a future format could be introduced
with an additive change (e.g. a sibling field or a lightweight prefix) without
disturbing existing notes. Deliberately deferred — no discriminator is carried
now, per "skip BlockNote completely."

---

## Routing

The new-tab page becomes a tiny client-side router (hash-based — zero deps, no
server routes, survives extension reload):

| Hash | View |
|---|---|
| `#/` (or empty) | Planner (current `App`) |
| `#/note/<date>` | Per-day note page |
| `#/note/<date>/<hour>` | Per-slot note page |

- Opening a new tab always lands on the planner (good default).
- Back (browser back or an in-page `←`) returns to the planner **at the same
  date**, restoring scroll position.
- Transition: keep the cream paper surface mounted and slide/cross-fade content
  (~200ms) so it reads as turning a page, not a screen swap.

---

## The Logical Note surface (faithful-reproduction checklist)

Pure CSS, layered on a cream (`#fcfcfb`) surface. From the reference photos:

1. **Three-tier horizontal ruling** — a solid thin baseline every *N*px, plus
   two fainter **dotted** guides at *N*⁄3 and 2*N*⁄3 (the lower third is the
   small-text / English x-height band).
2. **Faint vertical paragraph guides** — full-height, evenly spaced, lighter
   than the horizontals; double as a table/figure grid with the baselines.
3. **Margin tick marks (メモリ)** — small marks top *and* bottom, aligned to the
   verticals (the page-split anchors). Decorative in v1; functional splitting is
   out of scope.
4. **`Date` field** — top-right, light-gray "Date" label, thin underline with
   tiny tick dots.
5. **Tone & weight** — desaturated gray-blue lines, thin; solids barely darker
   than the dotted thirds. Nothing pure black.

Implemented as a reusable `<RuledSheet>` so both note variants and (optionally,
later) the agenda share one source of truth for the ruling.

---

## Note page anatomy

```
┌────────────────────────────────────────────────────────────┐
│  ←  June 9, 2026  ·  14:00                    [ⓘ]  saved ✓   │  top bar
│  ┌──────────────────────────────────────────┐ ┌───────────┐ │
│  │  Logical Note writing surface (wide)       │ │ context   │ │
│  │  Date ─, ruled thirds, vertical guides     │ │ rail      │ │
│  └──────────────────────────────────────────┘ └───────────┘ │
└────────────────────────────────────────────────────────────┘
       (rail collapsed by default → surface spans full width)
```

- **Top bar:** `←` back to the day; breadcrumb (`date` or `date · HH:00`); an
  `ⓘ` toggle that expands the context rail; quiet `saved ✓` autosave indicator
  (no Save button; debounced like `useDay`).
- **Context rail (collapsible, right, read-only):** **collapsed by default** so
  the writing surface spans full width. Expanded via the `ⓘ` toggle, it slides
  in from the right and — opened from a slot — shows that hour's agenda text and
  pinned todos (the `slot` chips); opened per-day, day-level context. Recovers
  the side-panel's write-in-context advantage on demand without permanently
  narrowing the page.
- **Writing surface:** markdown with **live preview** — formatting renders as you
  type, directly on the ruling (the surface stays an editable, ruled notebook
  page rather than flipping between raw/rendered modes). Autosaves through the
  same debounced `update()` path as the planner.

---

## Entry points (anti-clutter)

- **Per-slot:** a `✎` button on the agenda row, shown only on hover (reusing the
  existing `opacity-0 group-hover:opacity-100` pattern from the delete/drag
  handles). A slot with a note shows a small dot indicator so notes are visible
  at a glance. Click → `#/note/<date>/<hour>`.
- **Per-day:** a "Notes" affordance in the day header → `#/note/<date>`.
- **Variant flag:** a single flag gates the per-slot affordance. Off = per-day
  only (variant A); on = per-day + per-slot (variant B). Same surface either way.

---

## Sync / Export / MCP

- **Sync (REST + SSE, Gist):** notes are plain fields on `DayEntry`, serialized
  as strings — they flow through `putDay`, the SSE change feed, IndexedDB cache,
  and the Gist envelope with **no transport changes**.
- **Export/import:** envelope already serializes whole `DayEntry` objects; notes
  ride along. Import's loose structural check needs no change (extra fields are
  preserved on `put`).
- **MCP:** v1 ships **read support only** — `get_day` returns `note`/`slotNotes`
  naturally. Write tools (`set_note` / `set_slot_note`) are deferred to a
  follow-up.

---

## Build sequence

1. **Model + persistence** — `note`/`slotNotes` (plain strings) on `DayEntry`
   (both type defs) + Zod; `hasContent` updates; store passthrough. Tests:
   note round-trips file + gist mode; lazy cleanup with notes.
2. **`<RuledSheet>`** — the CSS Logical Note surface, in isolation. Visual check.
3. **Router** — hash routing in the newtab entry; planner ↔ note view; back +
   scroll restore; page-turn transition.
4. **Note page** — top bar, collapsible right context rail, live-preview
   markdown editor, debounced autosave reusing `useDay`. Per-day route first,
   then per-slot with the rail populated.
5. **Entry points** — header "Notes" button; hover `✎` + dot on agenda rows;
   the variant flag (dev-only constant for the prototype).

Each step is independently shippable; markdown-first keeps every step small.

---

## Resolved decisions

- **Content format:** plain markdown string, no discriminator. BlockNote dropped
  entirely — the notebook UI is pure CSS and doesn't need it.
- **Context rail:** collapsible, right-side, collapsed by default.
- **Editor (revised 2026-06-10):** live **styled-source** editing — CodeMirror 6
  with a markdown highlight theme. The source is always editable; `# Title`
  styles as a heading *as you type* with the marks visible and receded
  (iA-Writer style). Supersedes the first-pass render-on-blur textarea, which
  was built, reviewed, and rejected ("I would like a way to render markdown as
  we are typing"). markdown-it was removed with it; CM6 never renders HTML, so
  notes are XSS-safe by construction.
- **Sheet (revised 2026-06-10):** ruling kept but much fainter (baselines 0.22,
  thirds 0.10, verticals 0.05, ticks 0.12) and the decorative Date block
  removed, after feedback that the full-strength ruling wasn't calm.
- **MCP note tools:** read-only this pass; write tools (`set_note` /
  `set_slot_note`) deferred to a follow-up.
- **Variant flag:** dev-only constant for the prototype (no Options toggle yet).

---

## Out of scope (v1)

- MCP write tools for notes (follow-up).
- Functional page-splitting (the メモリ marks are decorative for now).
- BlockNote / full rich text — dropped entirely; markdown is the format.
