# Rich Notes (#5) — Work Handoff

**Date:** 2026-06-10
**Branch:** `feature/rich-notes`
**Spec:** `docs/superpowers/specs/2026-06-09-rich-notes-design.md` (Status: Approved)

Resume point for the rich-notes feature. Read the spec first — this doc only
tracks *where we are* against its 6-step build sequence.

---

## ▶️ Resume prompt (paste this to start the next session)

```
Continue the rich-notes feature (#5) on the `feature/rich-notes` branch.

Read these first, in order:
1. docs/superpowers/specs/2026-06-09-rich-notes-design.md  (approved design)
2. docs/superpowers/plans/2026-06-10-rich-notes-handoff.md (where we left off)

Then pick up at the top of "Next actions" in the handoff:
- First, tune entrypoints/newtab/components/RuledSheet.tsx against the
  notebook photos in /mnt/c/Users/wouter/Downloads/ (IMG_1120.jpg upright,
  IMG_1123.jpg). Main fix: the vertical guides read too "graph-paper" —
  space them wider and fainter so it reads as ruled lines with occasional
  paragraph guides. Verify with the screenshot loop documented in the
  handoff, and show me a screenshot before moving on.
- Then proceed through steps 3→5 (router, note page, entry points), pausing
  for my review after each step.

Conventions: markdown-only notes (BlockNote is dropped); keep tests lean and
realistic; no Co-Authored-By trailer on commits; commit per step with a clear
message; don't push unless I ask.
```

---

## Status by step

| Step | What | State |
|---|---|---|
| 1 | Model + persistence (`note`/`slotNotes` strings, Zod, `hasContent`, tests) | ✅ done & committed (`a2c49d5`) |
| 2 | `<RuledSheet>` — Logical Note CSS surface | 🟡 first pass committed, **needs visual tuning** |
| 3 | Hash router (planner ↔ note view, back + scroll restore, page-turn) | ⬜ not started |
| 4 | Note page (top bar, collapsible right rail, live-preview markdown, autosave) | ⬜ not started |
| 5 | Entry points (header "Notes" btn, hover ✎ + dot on agenda rows, variant flag) | ⬜ not started |
| 6 | *(follow-up)* MCP write tools `set_note` / `set_slot_note` | ⬜ deferred |

Nothing is pushed. Full test suite was green at step 1 (72 passing), `tsc` clean.

---

## Step 1 recap (done)

- `note?: string` + `slotNotes?: Record<number,string>` on `DayEntry` in both
  `entrypoints/newtab/lib/types.ts` and `server/types.ts` (Zod), keyed like
  `agenda`.
- `hasContent()` in `server/store.ts` and `entrypoints/newtab/lib/db.ts` now
  counts notes → lazy cleanup keeps a note-only day and drops it when cleared.
- Notes ride the existing `putDay`/sync/Gist/export pipeline as plain strings;
  no store method or transport changes.
- Tests in `tests/server-store.test.ts`: note round-trip + note-only cleanup.

## Step 2 recap (needs tuning)

- New component: `entrypoints/newtab/components/RuledSheet.tsx`.
- Pure SVG `<pattern>` ruling, all lines `currentColor` (one text color drives
  the sheet; opacity separates the three tiers). Constants `ROW = 28`,
  `CELL = 28`. Renders: solid baseline, dotted ⅓/⅔ guides, faint vertical
  guides, top/bottom margin ticks (メモリ), and the "Date" field top-right.
- Not yet mounted anywhere (no router until step 3).

### ⚠️ Tuning notes — do these against the photos before moving on
1. **Verticals read too "graph-paper."** `CELL = 28` (square grid) is too dense.
   In the real Logical Note the vertical guides are spaced **wider** and **fainter**
   so the page reads as ruled lines with occasional paragraph guides. Try
   `CELL = 56`–`84` and/or drop `strokeOpacity` on the vertical line (currently
   `0.18`). Square-grid is only wanted for the table use-case, not the default.
2. **User note (their words):** *"at the top of the document there are small
   things for the ruling stuff — real subtle but it's there."* They're confirming
   the subtle top-margin alignment marks (メモリ) exist. We render top+bottom
   ticks already — double-check ours match the photos' position/subtlety, and
   look again for any additional faint detail at the very top of the page.
3. Fine-tune `ROW`, line colors/opacities, and the `Date` field weight against
   `/mnt/c/Users/wouter/Downloads/IMG_1120.jpg` (upright page) and `IMG_1123.jpg`.

---

## How to preview `<RuledSheet>` (the screenshot loop)

`file://` is blocked in the Playwright MCP browser and the extension new-tab
isn't a plain URL, so we verify with a **static HTML mirror served over HTTP**:

1. Write a standalone HTML that inlines the same SVG/CSS as `RuledSheet.tsx`
   (light + dark sheets side by side) to `/tmp/ruledsheet-preview.html`.
   *(The `/tmp` copy from today is gone after reboot — recreate it from the
   component markup; keep it out of the repo.)*
2. Serve it: `cd /tmp && python3 -m http.server 8799` (background).
3. Playwright MCP: `browser_resize` → `browser_navigate` to
   `http://127.0.0.1:8799/ruledsheet-preview.html` → `browser_take_screenshot`.
4. Screenshot lands in the project root / `.playwright-mcp/` — **both are
   git-ignored now**; don't commit them.

Once the router exists (step 3) we can preview the real component instead of a
mirror, via `bun run dev`.

---

## Next actions (tomorrow, in order)

1. Tune `<RuledSheet>` per the notes above; re-screenshot; get a 👍.
2. **Step 3 — router.** Hash routes `#/`, `#/note/<date>`, `#/note/<date>/<hour>`
   in `entrypoints/newtab/main.tsx` / `App.tsx`. Back + scroll restore, page-turn
   transition. No deps.
3. **Step 4 — note page.** Mounts `<RuledSheet>`, top bar (`←` + breadcrumb +
   `saved ✓`), collapsible right context rail (slot's agenda text + pinned
   todos), live-preview markdown editor (adds a small markdown dep — `marked` or
   `react-markdown`), autosave through `useDay`'s debounced `update()`.
4. **Step 5 — entry points** + dev-only variant flag.

## Housekeeping
- Background `python3 -m http.server 8799` on `/tmp` may still be running — kill
  it (`pkill -f 'http.server 8799'`) if so.
- Helper server still runs the pre-notes code; restart it when notes need to
  round-trip through MCP/sync end-to-end.
