import type { DayEntry } from './types';

/**
 * Immutably set the day note (hour undefined) or an hour's slot note. Empty
 * text removes the field/key instead of storing '' — mirroring the server
 * store's setNote/setSlotNote — so cleared notes don't linger in the data.
 */
export function withNote(prev: DayEntry, hour: number | undefined, text: string): DayEntry {
  const next = { ...prev };
  if (hour === undefined) {
    if (text === '') {
      delete next.note;
    } else {
      next.note = text;
    }
    return next;
  }
  const notes = { ...next.slotNotes };
  if (text === '') {
    delete notes[hour];
  } else {
    notes[hour] = text;
  }
  if (Object.keys(notes).length === 0) {
    delete next.slotNotes;
  } else {
    next.slotNotes = notes;
  }
  return next;
}
