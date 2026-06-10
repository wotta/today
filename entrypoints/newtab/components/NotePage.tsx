import { useState } from 'react';
import { useDay } from '../lib/useDay';
import { closeNote } from '../lib/route';
import { formatLongDate, hourLabel } from '../lib/date';
import type { CheckItem } from '../lib/types';
import { MarkdownEditor } from './MarkdownEditor';
import { RuledSheet } from './RuledSheet';

interface Props {
  date: string;
  /** Agenda hour for a per-slot note; absent for the day note. */
  hour?: number;
}

/**
 * Full-screen note page — the "notes pages" of the same notebook the planner
 * is a page of. The editor styles markdown source live as you type (marks stay
 * visible). A collapsible right rail shows read-only context: the slot's
 * agenda line and pinned todos, or day-level context.
 */
export function NotePage({ date, hour }: Props) {
  const { entry, update, online } = useDay(date);
  const [railOpen, setRailOpen] = useState(false);

  const value = hour === undefined ? (entry.note ?? '') : (entry.slotNotes?.[hour] ?? '');
  const setValue = (text: string) =>
    update((prev) =>
      hour === undefined
        ? { ...prev, note: text }
        : { ...prev, slotNotes: { ...prev.slotNotes, [hour]: text } },
    );

  const pinned =
    hour === undefined ? [] : entry.checkItems.filter((it) => it.slot === hour);

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
          <button
            type="button"
            onClick={() => setRailOpen((v) => !v)}
            aria-label={railOpen ? 'Hide context' : 'Show context'}
            aria-expanded={railOpen}
            className={
              'text-[13px] transition-colors ' +
              (railOpen
                ? 'text-stone-600 dark:text-stone-300'
                : 'text-stone-300 hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300')
            }
          >
            ⓘ
          </button>
        </div>

        <div className="flex flex-1 items-stretch gap-3">
          {/* The notebook sheet */}
          <RuledSheet className="min-h-[75vh] flex-1 rounded-sm border border-stone-200 text-stone-700 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] dark:border-stone-700 dark:text-stone-200 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_12px_32px_-12px_rgba(0,0,0,0.6)]">
            <MarkdownEditor
              value={value}
              onChange={setValue}
              ariaLabel={
                hour === undefined
                  ? `Notes for ${date}`
                  : `Notes for ${date} at ${hourLabel(hour)}`
              }
            />
          </RuledSheet>

          {/* Collapsible context rail (read-only) */}
          {railOpen && (
            <aside className="page-turn w-52 shrink-0 pt-2 text-[13px]">
              {hour !== undefined ? (
                <SlotContext agendaText={entry.agenda[hour] ?? ''} pinned={pinned} />
              ) : (
                <DayContext items={entry.checkItems} />
              )}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function SlotContext({ agendaText, pinned }: { agendaText: string; pinned: CheckItem[] }) {
  return (
    <>
      <RailHeading>Agenda</RailHeading>
      <p className="text-stone-600 dark:text-stone-300">
        {agendaText || <span className="text-stone-300 dark:text-stone-600">No entry</span>}
      </p>
      <RailHeading className="mt-4">Pinned</RailHeading>
      {pinned.length === 0 ? (
        <p className="text-stone-300 dark:text-stone-600">No pinned tasks</p>
      ) : (
        <ul className="space-y-1">
          {pinned.map((it) => (
            <li
              key={it.id}
              className={
                it.done
                  ? 'text-stone-400 line-through dark:text-stone-500'
                  : 'text-stone-600 dark:text-stone-300'
              }
            >
              {it.done ? '☑' : '☐'} {it.text}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DayContext({ items }: { items: CheckItem[] }) {
  return (
    <>
      <RailHeading>Check</RailHeading>
      {items.length === 0 ? (
        <p className="text-stone-300 dark:text-stone-600">No tasks</p>
      ) : (
        <ul className="space-y-1">
          {[...items]
            .sort((a, b) => a.order - b.order)
            .map((it) => (
              <li
                key={it.id}
                className={
                  it.done
                    ? 'text-stone-400 line-through dark:text-stone-500'
                    : 'text-stone-600 dark:text-stone-300'
                }
              >
                {it.done ? '☑' : '☐'} {it.text}
              </li>
            ))}
        </ul>
      )}
    </>
  );
}

function RailHeading({ children, className = '' }: { children: string; className?: string }) {
  return (
    <h2
      className={
        'mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 ' +
        className
      }
    >
      {children}
    </h2>
  );
}
