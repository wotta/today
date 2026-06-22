import { addDays, dayOfWeek, formatLongDate, todayKey, WEEKDAY_LETTERS, WEEKDAY_NAMES } from '../lib/date';

interface Props {
  date: string;
  onDateChange: (date: string) => void;
}

export function DateHeader({ date, onDateChange }: Props) {
  const today = todayKey();
  const isToday = date === today;
  const activeDow = dayOfWeek(date);

  return (
    <header className="mb-7">
      <div className="flex items-end justify-between gap-4">
        {/* Date field, echoing the notebook's diagonal-slash cell */}
        <div className="flex items-end gap-2">
          <button
            type="button"
            aria-label="Previous day"
            aria-keyshortcuts="ArrowLeft Shift+ArrowLeft"
            title="Previous day (←) — previous week (Shift+←)"
            onClick={() => onDateChange(addDays(date, -1))}
            className="pb-1 text-xl leading-none text-stone-300 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300"
          >
            ‹
          </button>
          <div className="relative pl-3">
            <span
              aria-hidden
              className="absolute -left-1 top-0 h-full w-px -rotate-[24deg] bg-stone-300 dark:bg-stone-600"
            />
            <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
              Date
            </span>
            <span className="block whitespace-nowrap text-2xl font-semibold leading-tight tracking-tight text-stone-800 tabular-nums dark:text-stone-100">
              {formatLongDate(date)}
            </span>
          </div>
          <button
            type="button"
            aria-label="Next day"
            aria-keyshortcuts="ArrowRight Shift+ArrowRight"
            title="Next day (→) — next week (Shift+→)"
            onClick={() => onDateChange(addDays(date, 1))}
            className="pb-1 text-xl leading-none text-stone-300 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300"
          >
            ›
          </button>
          <button
            type="button"
            aria-keyshortcuts="t"
            title="Jump to today (t)"
            onClick={() => onDateChange(today)}
            tabIndex={isToday ? -1 : 0}
            className={`mb-1 ml-1 rounded-full border border-stone-300 px-2.5 py-0.5 text-[11px] font-medium text-stone-500 transition-colors hover:border-stone-500 hover:text-stone-800 dark:border-stone-600 dark:text-stone-400 dark:hover:border-stone-400 dark:hover:text-stone-100 ${isToday ? 'invisible' : ''}`}
          >
            Today
          </button>
        </div>

        {/* Day ( S M T W T F S ) — current day circled */}
        <div className="flex items-center gap-1 text-sm font-medium text-stone-400 dark:text-stone-500">
          <span className="mr-1 text-[10px] uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
            Day
          </span>
          <span className="text-stone-300 dark:text-stone-600">(</span>
          {WEEKDAY_LETTERS.map((letter, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to ${WEEKDAY_NAMES[i]} this week`}
              aria-pressed={i === activeDow}
              title={`Go to ${WEEKDAY_NAMES[i]} this week`}
              onClick={() => onDateChange(addDays(date, i - activeDow))}
              className={
                i === activeDow
                  ? 'flex h-6 w-6 items-center justify-center rounded-full border-2 border-rose-400 font-semibold text-stone-700 transition-colors dark:border-rose-400 dark:text-stone-100'
                  : 'flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200'
              }
            >
              {letter}
            </button>
          ))}
          <span className="text-stone-300 dark:text-stone-600">)</span>
        </div>
      </div>

      <div className="mt-3 border-b-2 border-stone-300 dark:border-stone-700" />
    </header>
  );
}
