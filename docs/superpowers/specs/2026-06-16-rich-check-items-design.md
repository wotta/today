# Rich check items: description + view/edit modal

**Date:** 2026-06-16
**Status:** Approved, ready for implementation plan

## Problem

A long check-item title overflows its container. In the agenda, a pinned
`Chip` pushes its text past the right edge of the hour row instead of
truncating (see the "Ticket aanmaken voor EA settings pagina…" example). There
is also no place to record more detail about a task than its one-line title.

## Goal

1. Truncate long titles cleanly in both surfaces where a `CheckItem` renders
   (the "Check" list and the agenda chips).
2. Add an optional long-form **description** to check items.
3. Give each item a "view" affordance that opens a modal showing the full
   title + description, where both can be edited.

Attachments are explicitly **out of scope** for this spec — deferred to a
separate design.

## Data model

Extend `CheckItem` with one optional field, in **both** the client and the
server Zod schema so the gist round-trip stays valid:

- `entrypoints/newtab/lib/types.ts` — add `description?: string` to the
  `CheckItem` interface.
- `server/types.ts` — add `description: z.string().optional()` to
  `CheckItemSchema`.

`text` is unchanged and serves as the **title** (no rename). The field is
optional and additive, so:

- existing days, existing gists, and the server round-trip stay
  backward-compatible (absent `description` = no description);
- the MCP `add_check_item` / `update_check_item` tools keep working untouched.

Description is **plain multi-line text** (a `<textarea>`), not markdown. A
markdown upgrade is possible later but is not part of this work.

## Truncation fix

The agenda `Chip` (in `entrypoints/newtab/components/Agenda.tsx`) already marks
its inner text span `truncate`, but the span cannot shrink because its flex
parent lacks `min-w-0`, so it overflows the row. Fix:

- add `min-w-0` to the truncating text span;
- cap the chip width so a long title ellipsizes within the agenda row.

The "Check" list row uses an editable `<input>`, which already scrolls rather
than overflowing, so no layout fix is needed there beyond adding the view
affordance.

## View affordance

- **Agenda chip:** a small always-visible expand icon (`⤢`) placed between the
  text and the `✕` (space is tight and the text is truncated, so it stays
  visible).
- **Check list row:** a hover-revealed button next to the delete `✕`, matching
  the existing hover pattern. When an item *has* a description, show a subtle
  persistent indicator (styled like the existing slot pill) so you can tell
  there is more without hovering.

The Check list keeps its inline editable title input for quick edits. Clicking
the view affordance in either surface opens the modal for that item.

## Modal

A new reusable `Modal.tsx` plus a `CheckItemDialog.tsx` built on it, both under
`entrypoints/newtab/components/`.

`Modal.tsx`:

- fixed overlay + centered panel;
- closes on backdrop click and on `Esc`;
- moves focus into the panel when opened.

`CheckItemDialog.tsx` contents:

- **Title** — editable single-line input, writes to `text`.
- **Description** — editable `<textarea>`, writes to `description`.
- **Meta/footer** — done-toggle; the pinned agenda hour when `slot` is set; a
  Done/Close button.

Edits save live through the same `update(mutate: (prev: DayEntry) => DayEntry)`
flow the components already use, keeping the dialog in sync with Dexie and the
server. No new global state: each of `Agenda` and `Checklist` tracks the
currently-open item id with a local `useState<string | null>` and renders the
dialog for it.

## Testing

- Extend the existing server/db round-trip tests (`server-store`, `db`) to
  assert that `description` survives a save/load cycle.
- Component test: opening the modal shows the full title + description; editing
  the description persists via `update`; a long title truncates (ellipsis) in
  the agenda chip rather than overflowing.

## Out of scope

- Attachments (files/images) — separate spec.
- Markdown rendering for the description.
- Any change to how items are created (the inline add row still takes just a
  title).
