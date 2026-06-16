import { useLayoutEffect, useRef } from 'react';
import { hourLabel } from '../lib/date';
import type { CheckItem } from '../lib/types';
import { Modal } from './Modal';

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

      <textarea
        aria-label="Description"
        value={item.description ?? ''}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Add a description…"
        rows={8}
        className="mt-4 w-full resize-y rounded-lg border border-stone-200 bg-stone-50 p-3 text-[15px] leading-relaxed text-stone-700 outline-none placeholder:text-stone-300 focus:border-stone-300 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-200 dark:placeholder:text-stone-600"
      />
    </Modal>
  );
}
