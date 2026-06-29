# Esc exits the note page — design

## Goal

As a user on the note edit page, I want to leave the page by pressing `Esc`
when the editor is no longer focused.

## Background

- The note page (`components/NotePage.tsx`) renders a CodeMirror 6 editor
  (a `contentEditable` element, not a literal `<textarea>`).
- Leaving the page already exists as `closeNote()` in `lib/route.ts` — it calls
  `history.back()` when the planner navigated here, else resets the hash. The
  page's back button (`←`) already wires to it.
- Global shortcuts live in `lib/useDateShortcuts.ts`. Its keydown handler already
  treats `Esc` specially: when an editable element is focused, `Esc` blurs it
  (so day-nav arrows work afterwards). Editable detection is the `isEditable()`
  helper in that file (handles `contentEditable`, `TEXTAREA`, text-like `INPUT`).

## Behavior

- On the note page, `Esc` while **no** editable element is focused → `closeNote()`.
- `Esc` while the editor (or any editable element) is focused → unchanged: the
  existing `useDateShortcuts` handler blurs it.

This yields the intended UX without extra state:

| Starting focus        | 1st Esc        | 2nd Esc        |
|-----------------------|----------------|----------------|
| Editor focused        | blur editor    | close page     |
| Nothing/button/rail   | close page     | —              |

The story — "exit by pressing esc when the editor isn't in focus anymore" — is
satisfied: closing only happens once focus has left the editor.

## Changes

Two files.

1. **`lib/useDateShortcuts.ts`** — add `export` to the existing `isEditable`
   function so NotePage reuses the same focus check. No behavior change.

2. **`components/NotePage.tsx`** — add a `useEffect` registering a `window`
   `keydown` listener:
   - bail unless `e.key === 'Escape'`;
   - bail if `isEditable(e.target)` (editor still focused — let the blur happen);
   - otherwise `closeNote()`.

   The effect mounts/unmounts with the page, so it is active only on the note
   route — no route guard required. Empty dependency array (`closeNote` is a
   module-level import, stable).

## Edge cases

- Editor focused → handler skips; `useDateShortcuts` blur wins. ✓
- Back button, rail toggle, or nothing focused → these are non-editable, so
  `Esc` closes. ✓ (consistent with "not in focus")
- No `preventDefault()` — nothing else consumes a bare `Esc` on this page.
- Two `keydown` listeners observe the same `Esc` (this one + `useDateShortcuts`).
  They don't conflict: when the editor is focused only the blur branch acts;
  when unfocused only the close branch acts.

## Testing

Playwright e2e (`e2e/note-esc.spec.ts`). Note: the editor autofocuses on
mount, so a freshly opened note always needs the blur press first.

1. Open a note (editor autofocused), press `Esc` → editor blurs, still on note
   page. Press `Esc` again → back on planner.
2. Open a note, click a non-editable element (the date heading) to blur the
   editor, then a single `Esc` → returns to planner.

## Out of scope (YAGNI)

- No on-screen hint or tooltip about the shortcut.
- No configuration toggle.
