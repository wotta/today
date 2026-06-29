import { type Dispatch, type SetStateAction, useEffect } from 'react';
import { addDays, todayKey } from './date';

/** Text-entry targets where bare keys must keep their normal editing behavior. */
export function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const nonText = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'];
    return !nonText.includes((el as HTMLInputElement).type);
  }
  return false;
}

/**
 * Global day/week navigation:
 *   ← / →            ± one day
 *   Shift+← / Shift+→ ± one week
 *   t                 jump to today
 *   Esc               blur the focused field (so arrows can navigate)
 *
 * Shortcuts are suppressed while a text field is focused, so typing — including
 * cursor movement with the arrow keys — is never disrupted.
 */
export function useDateShortcuts(setDate: Dispatch<SetStateAction<string>>) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditable(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      // Leave OS/browser combos (Ctrl/Cmd/Alt) alone.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setDate((d) => addDays(d, e.shiftKey ? -7 : -1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setDate((d) => addDays(d, e.shiftKey ? 7 : 1));
          break;
        case 't':
        case 'T':
          e.preventDefault();
          setDate(todayKey());
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setDate]);
}
