import type { DayEntry } from '../lib/types';
import { AGENDA_END_HOUR, AGENDA_START_HOUR } from '../lib/types';
import { hourLabel, isLateNight } from '../lib/date';

interface Props {
  agenda: Record<number, string>;
  update: (mutate: (prev: DayEntry) => DayEntry) => void;
  /** Hour to subtly mark as "now", or null when not viewing today. */
  currentHour: number | null;
}

const HOURS = Array.from(
  { length: AGENDA_END_HOUR - AGENDA_START_HOUR + 1 },
  (_, i) => AGENDA_START_HOUR + i,
);

export function Agenda({ agenda, update, currentHour }: Props) {
  const setHour = (hour: number, text: string) =>
    update((prev) => ({ ...prev, agenda: { ...prev.agenda, [hour]: text } }));

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold tracking-tight text-stone-700 dark:text-stone-200">
        Agenda
      </h2>
      <ul>
        {HOURS.map((hour) => {
          const even = hour % 2 === 0;
          const isNow = hour === currentHour;
          return (
            <li
              key={hour}
              className={
                'flex items-stretch ' +
                // Even hours get a solid hour line; odd hours a fainter half-hour rule.
                (even
                  ? 'border-t border-stone-300 dark:border-stone-700 '
                  : 'border-t border-stone-200/60 dark:border-stone-700/40 ') +
                (isNow ? 'bg-amber-50/70 dark:bg-amber-400/10' : '')
              }
            >
              <span
                className={
                  'w-14 shrink-0 select-none border-r border-stone-300 py-1 pr-3 text-right text-[11px] tabular-nums dark:border-stone-700 ' +
                  (even
                    ? isLateNight(hour)
                      ? 'text-stone-300 dark:text-stone-600'
                      : 'text-stone-400 dark:text-stone-500'
                    : 'text-transparent') +
                  (isNow ? ' font-semibold !text-amber-600 dark:!text-amber-400' : '')
                }
              >
                {even ? hourLabel(hour) : ''}
              </span>
              <input
                value={agenda[hour] ?? ''}
                onChange={(e) => setHour(hour, e.target.value)}
                className="min-h-[34px] flex-1 bg-transparent px-3 text-[15px] text-stone-700 outline-none dark:text-stone-200"
                aria-label={`Agenda at ${hourLabel(hour)}`}
              />
            </li>
          );
        })}
        {/* Closing line beneath the final hour */}
        <li className="border-t border-stone-300 dark:border-stone-700" aria-hidden />
      </ul>
    </section>
  );
}
