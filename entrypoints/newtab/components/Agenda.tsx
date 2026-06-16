import { useState } from 'react';
import type { CheckItem, DayEntry } from '../lib/types';
import { AGENDA_END_HOUR, AGENDA_START_HOUR, ITEM_DRAG_MIME } from '../lib/types';
import { hourLabel, isLateNight } from '../lib/date';
import { PER_SLOT_NOTES } from '../lib/flags';
import { noteHash } from '../lib/route';
import { CheckItemDialog } from './CheckItemDialog';

interface Props {
  date: string;
  agenda: Record<number, string>;
  checkItems: CheckItem[];
  /** Hour -> markdown note, to mark hours that have one. */
  slotNotes?: Record<number, string>;
  update: (mutate: (prev: DayEntry) => DayEntry) => void;
  /** Hour to subtly mark as "now", or null when not viewing today. */
  currentHour: number | null;
}

const HOURS = Array.from(
  { length: AGENDA_END_HOUR - AGENDA_START_HOUR + 1 },
  (_, i) => AGENDA_START_HOUR + i,
);

export function Agenda({ date, agenda, checkItems, slotNotes, update, currentHour }: Props) {
  // The hour currently hovered during a drag, for a drop-target highlight.
  const [dropHour, setDropHour] = useState<number | null>(null);
  // The item whose view/edit dialog is open, if any.
  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = checkItems.find((it) => it.id === openId) ?? null;

  const setHour = (hour: number, text: string) =>
    update((prev) => ({ ...prev, agenda: { ...prev.agenda, [hour]: text } }));

  /** Pin a checklist item to an hour (or move it between hours). */
  const pin = (id: string, hour: number) =>
    update((prev) => ({
      ...prev,
      checkItems: prev.checkItems.map((it) => (it.id === id ? { ...it, slot: hour } : it)),
    }));

  const unpin = (id: string) =>
    update((prev) => ({
      ...prev,
      checkItems: prev.checkItems.map((it) =>
        it.id === id ? { ...it, slot: undefined } : it,
      ),
    }));

  const toggle = (id: string) =>
    update((prev) => ({
      ...prev,
      checkItems: prev.checkItems.map((it) =>
        it.id === id ? { ...it, done: !it.done } : it,
      ),
    }));

  const patch = (id: string, p: { text?: string; description?: string; done?: boolean }) =>
    update((prev) => ({
      ...prev,
      checkItems: prev.checkItems.map((it) => (it.id === id ? { ...it, ...p } : it)),
    }));

  // Group pinned items by their slot so each hour can render its chips.
  const pinnedByHour = new Map<number, CheckItem[]>();
  for (const item of checkItems) {
    if (item.slot === undefined) continue;
    const list = pinnedByHour.get(item.slot) ?? [];
    list.push(item);
    pinnedByHour.set(item.slot, list);
  }

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold tracking-tight text-stone-700 dark:text-stone-200">
        Agenda
      </h2>
      <ul>
        {HOURS.map((hour) => {
          const even = hour % 2 === 0;
          const isNow = hour === currentHour;
          const pinned = pinnedByHour.get(hour) ?? [];
          const hasNote = (slotNotes?.[hour] ?? '').trim() !== '';
          return (
            <li
              key={hour}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(ITEM_DRAG_MIME)) return;
                e.preventDefault();
                if (dropHour !== hour) setDropHour(hour);
              }}
              onDragLeave={() => setDropHour((h) => (h === hour ? null : h))}
              onDrop={(e) => {
                const id = e.dataTransfer.getData(ITEM_DRAG_MIME);
                setDropHour(null);
                if (!id) return;
                e.preventDefault();
                pin(id, hour);
              }}
              className={
                'group flex items-stretch ' +
                // Even hours get a solid hour line; odd hours a fainter half-hour rule.
                (even
                  ? 'border-t border-stone-300 dark:border-stone-700 '
                  : 'border-t border-stone-200/60 dark:border-stone-700/40 ') +
                (dropHour === hour
                  ? 'bg-amber-100/70 dark:bg-amber-400/15 '
                  : isNow
                    ? 'bg-amber-50/70 dark:bg-amber-400/10'
                    : '')
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
              <div className="flex min-h-[34px] min-w-0 flex-1 flex-col justify-center py-1">
                <div className="flex items-center">
                  <input
                    value={agenda[hour] ?? ''}
                    onChange={(e) => setHour(hour, e.target.value)}
                    className="flex-1 bg-transparent px-3 text-[15px] text-stone-700 outline-none dark:text-stone-200"
                    aria-label={`Agenda at ${hourLabel(hour)}`}
                  />
                  {PER_SLOT_NOTES && (
                    <button
                      type="button"
                      aria-label={`Open notes for ${hourLabel(hour)}`}
                      title={hasNote ? 'This hour has notes' : 'Add notes for this hour'}
                      onClick={() => {
                        window.location.hash = noteHash(date, hour);
                      }}
                      className={
                        'px-2 text-[13px] transition-opacity ' +
                        (hasNote
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-stone-300 opacity-0 hover:text-stone-600 focus-visible:opacity-100 group-hover:opacity-100 dark:text-stone-600 dark:hover:text-stone-300')
                      }
                    >
                      ✎
                    </button>
                  )}
                </div>
                {pinned.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-3 pt-1">
                    {pinned.map((item) => (
                      <Chip
                        key={item.id}
                        item={item}
                        onToggle={() => toggle(item.id)}
                        onUnpin={() => unpin(item.id)}
                        onView={() => setOpenId(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {/* Closing line beneath the final hour */}
        <li className="border-t border-stone-300 dark:border-stone-700" aria-hidden />
      </ul>
      {openItem && (
        <CheckItemDialog
          item={openItem}
          onChange={(p) => patch(openItem.id, p)}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}

function Chip({
  item,
  onToggle,
  onUnpin,
  onView,
}: {
  item: CheckItem;
  onToggle: () => void;
  onUnpin: () => void;
  onView: () => void;
}) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        // Re-pin by dragging the chip onto a different hour.
        e.dataTransfer.setData(ITEM_DRAG_MIME, item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={
        // min-w-0 lets this flex item shrink below its content width so the
        // label inside can truncate instead of overflowing the agenda row.
        'group/chip inline-flex min-w-0 max-w-full cursor-grab items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 py-0.5 pl-1.5 pr-1 text-[13px] dark:border-amber-400/20 dark:bg-amber-400/10 ' +
        (item.done ? 'opacity-60' : '')
      }
    >
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggle}
        aria-label={`Toggle "${item.text}"`}
        className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-amber-600 dark:accent-amber-400"
      />
      <span
        className={
          // min-w-0 lets the label shrink so `truncate` can ellipsize instead of
          // pushing the chip past the agenda row.
          'min-w-0 truncate ' +
          (item.done
            ? 'text-amber-700/60 line-through dark:text-amber-300/50'
            : 'text-amber-800 dark:text-amber-200')
        }
      >
        {item.text}
      </span>
      <button
        type="button"
        aria-label={`View "${item.text}"`}
        title="View details"
        onClick={onView}
        className="shrink-0 rounded-full px-0.5 text-amber-500/70 hover:text-amber-700 dark:text-amber-300/60 dark:hover:text-amber-200"
      >
        ⤢
      </button>
      <button
        type="button"
        aria-label={`Unpin "${item.text}"`}
        onClick={onUnpin}
        className="shrink-0 rounded-full px-1 text-amber-500/70 hover:text-amber-700 dark:text-amber-300/60 dark:hover:text-amber-200"
      >
        ✕
      </button>
    </span>
  );
}
