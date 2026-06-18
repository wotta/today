import { Suspense, lazy, useLayoutEffect, useRef } from 'react';
import { hourLabel } from '../lib/date';
import type { CheckItem } from '../lib/types';
import { Modal } from './Modal';

// BlockNote (and its ProseMirror deps) are the heaviest part of the editor and
// are only needed once a check item is opened — lazy-load them so the planner
// view stays light.
const RichDescription = lazy(() => import('./RichDescription'));

interface Props {
  item: CheckItem;
  onChange: (patch: { text?: string; description?: string; done?: boolean }) => void;
  onClose: () => void;
}

/** View and edit a check item's full title and long-form description. */
export function CheckItemDialog({ item, onChange, onClose }: Props) {
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Grow the title box to fit its content so a long title is fully visible
  // (rather than clipped on one line). Re-runs whenever the text changes.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [item.text]);

  return (
    <Modal onClose={onClose} labelledBy="check-item-dialog-title">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.done}
          onChange={() => onChange({ done: !item.done })}
          aria-label="Toggle done"
          className="mt-1.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-stone-700 dark:accent-stone-300"
        />
        <textarea
          ref={titleRef}
          id="check-item-dialog-title"
          aria-label="Title"
          value={item.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Title"
          rows={1}
          className={
            'flex-1 resize-none overflow-hidden bg-transparent text-lg font-semibold leading-snug tracking-tight outline-none placeholder:text-stone-300 dark:placeholder:text-stone-600 ' +
            (item.done
              ? 'text-stone-400 line-through dark:text-stone-500'
              : 'text-stone-800 dark:text-stone-100')
          }
        />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mr-1 shrink-0 rounded px-1.5 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200"
        >
          ✕
        </button>
      </div>

      {item.slot !== undefined && (
        <p className="mt-2 ml-[30px] text-[13px] text-amber-700 dark:text-amber-300">
          Pinned to {hourLabel(item.slot)}
        </p>
      )}

      <Suspense
        fallback={
          <p className="mt-4 w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-[15px] leading-relaxed whitespace-pre-wrap text-stone-700 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-200">
            {item.description?.trim() ? (
              item.description
            ) : (
              <span className="text-stone-300 dark:text-stone-600">Add a description…</span>
            )}
          </p>
        }
      >
        <RichDescription
          value={item.description ?? ''}
          onChange={(description) => onChange({ description })}
          ariaLabel="Description"
        />
      </Suspense>
    </Modal>
  );
}
