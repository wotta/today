import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Agenda } from '../entrypoints/newtab/components/Agenda';
import { ITEM_DRAG_MIME, type CheckItem, type DayEntry } from '../entrypoints/newtab/lib/types';

const item = (over: Partial<CheckItem> = {}): CheckItem => ({
  id: 'a',
  text: 'Dit is een test',
  done: false,
  order: 0,
  ...over,
});

const day = (over: Partial<DayEntry> = {}): DayEntry => ({
  date: '2026-06-09',
  checkItems: [item()],
  agenda: {},
  ...over,
});

/** Apply the mutate fn captured from an `update` call to a starting day. */
function applied(update: ReturnType<typeof vi.fn>, prev: DayEntry): DayEntry {
  expect(update).toHaveBeenCalledOnce();
  return update.mock.calls[0][0](prev);
}

/** Locate the agenda row (li) for a given hour via its input's aria-label. */
function rowForHour(hour: number): HTMLElement {
  const input = screen.getByLabelText(`Agenda at ${hour}:00`);
  return input.closest('li')!;
}

/** Render the Agenda with required-but-irrelevant props defaulted. */
function renderAgenda(props: Partial<React.ComponentProps<typeof Agenda>> = {}) {
  return render(
    <Agenda
      date="2026-06-09"
      agenda={{}}
      checkItems={[item()]}
      update={vi.fn()}
      currentHour={null}
      {...props}
    />,
  );
}

describe('Agenda slot pinning', () => {
  it('renders a pinned item as a chip in its hour row', () => {
    renderAgenda({ checkItems: [item({ slot: 6 })] });

    const chip = screen.getByText('Dit is een test');
    expect(chip).toBeInTheDocument();
    // The chip lives in the 6:00 row, not some other hour.
    expect(rowForHour(6).contains(chip)).toBe(true);
    expect(rowForHour(7).contains(chip)).toBe(false);
  });

  it('pins a dropped checklist item to the hour it was dropped on', () => {
    const update = vi.fn();
    renderAgenda({ update });

    fireEvent.drop(rowForHour(6), {
      dataTransfer: { types: [ITEM_DRAG_MIME], getData: () => 'a' },
    });

    expect(applied(update, day()).checkItems[0].slot).toBe(6);
  });

  it('ignores a drop that does not carry a checklist item', () => {
    const update = vi.fn();
    renderAgenda({ update });

    fireEvent.drop(rowForHour(6), { dataTransfer: { types: ['text/plain'], getData: () => '' } });

    expect(update).not.toHaveBeenCalled();
  });

  it('unpins an item when its chip ✕ is clicked', async () => {
    const update = vi.fn();
    renderAgenda({ checkItems: [item({ slot: 6 })], update });

    await userEvent.click(screen.getByLabelText('Unpin "Dit is een test"'));

    expect(applied(update, day({ checkItems: [item({ slot: 6 })] })).checkItems[0].slot).toBeUndefined();
  });

  it('toggles done from the chip checkbox', async () => {
    const update = vi.fn();
    renderAgenda({ checkItems: [item({ slot: 6 })], update });

    await userEvent.click(screen.getByLabelText('Toggle "Dit is een test"'));

    expect(applied(update, day({ checkItems: [item({ slot: 6 })] })).checkItems[0].done).toBe(true);
  });
});
