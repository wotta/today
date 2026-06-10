import { useDay } from '../lib/useDay';
import { closeNote } from '../lib/route';
import { formatLongDate, hourLabel } from '../lib/date';
import { RuledSheet, SHEET_ROW } from './RuledSheet';

interface Props {
  date: string;
  /** Agenda hour for a per-slot note; absent for the day note. */
  hour?: number;
}

/**
 * Full-screen note page — the "notes pages" of the same notebook the planner
 * is a page of. Step-3 scope: plain markdown text autosaving through useDay;
 * live preview and the context rail land with step 4.
 */
export function NotePage({ date, hour }: Props) {
  const { entry, update, online } = useDay(date);

  const value = hour === undefined ? (entry.note ?? '') : (entry.slotNotes?.[hour] ?? '');
  const setValue = (text: string) =>
    update((prev) =>
      hour === undefined
        ? { ...prev, note: text }
        : { ...prev, slotNotes: { ...prev.slotNotes, [hour]: text } },
    );

  return (
    <div className="flex min-h-full justify-center px-4 pt-10 pb-18">
      <main className="flex w-full max-w-2xl flex-col">
        {/* Top bar */}
        <div className="mb-3 flex items-baseline gap-3 px-1">
          <button
            type="button"
            onClick={closeNote}
            aria-label="Back to planner"
            className="text-sm text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
          >
            ←
          </button>
          <h1 className="text-base font-semibold tracking-tight text-stone-700 dark:text-stone-200">
            {formatLongDate(date)}
            {hour !== undefined && (
              <span className="font-normal text-stone-400 dark:text-stone-500">
                {' '}
                · {hourLabel(hour)}
              </span>
            )}
          </h1>
          <span
            className="ml-auto select-none text-[11px] text-stone-300 dark:text-stone-600"
            title={online ? 'Synced with the helper server' : 'Saved locally'}
          >
            {online ? 'saved ✓' : 'saved locally'}
          </span>
        </div>

        {/* The notebook sheet */}
        <RuledSheet className="min-h-[75vh] flex-1 rounded-sm border border-stone-200 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] dark:border-stone-700 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_12px_32px_-12px_rgba(0,0,0,0.6)]">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            aria-label={
              hour === undefined ? `Notes for ${date}` : `Notes for ${date} at ${hourLabel(hour)}`
            }
            placeholder="Write…"
            className="block h-full min-h-[75vh] w-full resize-none bg-transparent px-8 text-[15px] text-stone-700 outline-none placeholder:text-stone-300 dark:text-stone-200 dark:placeholder:text-stone-600"
            style={{ lineHeight: `${SHEET_ROW}px`, paddingTop: SHEET_ROW * 2 }}
          />
        </RuledSheet>
      </main>
    </div>
  );
}
