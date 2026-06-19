import { useRef, useState } from 'react';
import type { CheckItem, DayEntry } from '../lib/types';
import { ITEM_DRAG_MIME } from '../lib/types';
import { hourLabel } from '../lib/date';
import { CheckItemDialog } from './CheckItemDialog';

interface Props {
  items: CheckItem[];
  update: (mutate: (prev: DayEntry) => DayEntry) => void;
}

function newId(): string {
  return crypto.randomUUID();
}

/** Return items sorted by their order field. */
function sorted(items: CheckItem[]): CheckItem[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function Checklist({ items, update }: Props) {
  const [draft, setDraft] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = sorted(items);
  const openItem = items.find((it) => it.id === openId) ?? null;

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    update((prev) => {
      const order = prev.checkItems.reduce((max, it) => Math.max(max, it.order), -1) + 1;
      const item: CheckItem = { id: newId(), text, done: false, order };
      return { ...prev, checkItems: [...prev.checkItems, item] };
    });
    setDraft('');
  };

  const toggle = (id: string) =>
    update((prev) => ({
      ...prev,
      checkItems: prev.checkItems.map((it) =>
        it.id === id ? { ...it, done: !it.done } : it,
      ),
    }));

  const editText = (id: string, text: string) =>
    update((prev) => ({
      ...prev,
      checkItems: prev.checkItems.map((it) => (it.id === id ? { ...it, text } : it)),
    }));

  const patch = (id: string, p: { text?: string; description?: string; done?: boolean }) =>
    update((prev) => ({
      ...prev,
      checkItems: prev.checkItems.map((it) => (it.id === id ? { ...it, ...p } : it)),
    }));

  const remove = (id: string) =>
    update((prev) => ({
      ...prev,
      checkItems: prev.checkItems.filter((it) => it.id !== id),
    }));

  /** Move dragged item to occupy the position of the target item, renumbering order. */
  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    update((prev) => {
      const ordered = sorted(prev.checkItems);
      const fromIdx = ordered.findIndex((it) => it.id === fromId);
      const toIdx = ordered.findIndex((it) => it.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = ordered.splice(fromIdx, 1);
      ordered.splice(toIdx, 0, moved);
      return {
        ...prev,
        checkItems: ordered.map((it, i) => ({ ...it, order: i })),
      };
    });
  };

  return (
    <section>
      <h2 className="mb-2 text-base font-semibold tracking-tight text-stone-700 dark:text-stone-200">
        Check
      </h2>

      <ul>
        {list.map((item) => (
          <li
            key={item.id}
            draggable
            onDragStart={(e) => {
              setDragId(item.id);
              // Let the agenda accept this item as a drop to pin it to an hour.
              e.dataTransfer.setData(ITEM_DRAG_MIME, item.id);
              e.dataTransfer.effectAllowed = 'copyMove';
            }}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) reorder(dragId, item.id);
              setDragId(null);
            }}
            className={
              'group flex items-center gap-2.5 border-b border-stone-200 py-2 transition-colors dark:border-stone-700/70 ' +
              (dragId === item.id ? 'opacity-40' : '')
            }
          >
            <span
              aria-hidden
              className="-ml-4 cursor-grab select-none text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-stone-600"
            >
              ⠿
            </span>
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggle(item.id)}
              className="h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[3px] border border-stone-400 bg-white transition-colors checked:border-stone-700 checked:bg-stone-700 checked:bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2016%2016%22%20fill=%22white%22><path%20d=%22M6.5%2010.6L3.9%208l-1%201%203.6%203.6L13%206.1l-1-1z%22/></svg>')] checked:bg-center checked:bg-no-repeat dark:border-stone-500 dark:bg-transparent dark:checked:border-stone-300 dark:checked:bg-stone-300 dark:checked:bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2016%2016%22%20fill=%22%231c1917%22><path%20d=%22M6.5%2010.6L3.9%208l-1%201%203.6%203.6L13%206.1l-1-1z%22/></svg>')]"
            />
            <input
              value={item.text}
              onChange={(e) => editText(item.id, e.target.value)}
              className={
                'flex-1 bg-transparent text-[15px] outline-none placeholder:text-stone-300 dark:placeholder:text-stone-600 ' +
                (item.done
                  ? 'text-stone-400 line-through dark:text-stone-500'
                  : 'text-stone-700 dark:text-stone-200')
              }
            />
            {item.slot !== undefined && (
              <span
                className="shrink-0 select-none rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"
                title="Pinned to the agenda"
              >
                {hourLabel(item.slot)}
              </span>
            )}
            <button
              type="button"
              aria-label={`View "${item.text}"`}
              title={item.description ? 'Has a description' : 'View details'}
              onClick={() => setOpenId(item.id)}
              className={
                'shrink-0 px-1 transition-opacity ' +
                (item.description
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-stone-300 opacity-0 hover:text-stone-600 focus-visible:opacity-100 group-hover:opacity-100 dark:text-stone-600 dark:hover:text-stone-300')
              }
            >
              ⤢
            </button>
            <button
              type="button"
              aria-label="Delete item"
              onClick={() => remove(item.id)}
              className="px-1 text-stone-300 opacity-0 transition-opacity hover:text-stone-600 group-hover:opacity-100 dark:text-stone-600 dark:hover:text-stone-300"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <AddRow draft={draft} setDraft={setDraft} onAdd={addItem} empty={list.length === 0} />

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

function AddRow({
  draft,
  setDraft,
  onAdd,
  empty,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onAdd: () => void;
  empty: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2.5 border-b border-stone-200 py-2 dark:border-stone-700/70">
      <span
        aria-hidden
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border border-dashed border-stone-300 text-xs leading-none text-stone-300 dark:border-stone-600 dark:text-stone-600"
      >
        +
      </span>
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAdd();
        }}
        placeholder={empty ? 'Add your first task…' : 'Add a task…'}
        className="flex-1 bg-transparent text-[15px] text-stone-700 outline-none placeholder:text-stone-300 dark:text-stone-200 dark:placeholder:text-stone-600"
      />
    </div>
  );
}
