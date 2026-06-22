import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Agenda } from '../entrypoints/newtab/components/Agenda';
import { ITEM_DRAG_MIME, type CheckItem, type DayEntry } from '@today/types';

// The description editor lazy-loads BlockNote (ProseMirror), which doesn't run
// under jsdom. Stub it with a plain textarea so the dialog's description path
// stays testable here; its own behaviour lives in RichDescription.test.tsx.
vi.mock('../entrypoints/newtab/components/RichDescription', () => ({
  default: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (markdown: string) => void;
    ariaLabel: string;
  }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

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

  it('renders a half-hour item in a :30 sub-band at 30-min granularity', () => {
    renderAgenda({ slotMinutes: 30, checkItems: [item({ slot: 6.5 })] });

    // The chip shows in the 6:00 row, alongside the row's :30 band label.
    const chip = screen.getByText('Dit is een test');
    expect(rowForHour(6).contains(chip)).toBe(true);
    expect(rowForHour(6).textContent).toContain(':30');
    // The geometry-driven drop itself is covered end-to-end in e2e/agenda-slots.
  });

  it('folds a legacy half-hour item onto the hour at on-the-hour granularity', () => {
    renderAgenda({ slotMinutes: 60, checkItems: [item({ slot: 6.5 })] });

    const chip = screen.getByText('Dit is een test');
    expect(rowForHour(6).contains(chip)).toBe(true);
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

  it('opens the view dialog from the chip and shows the full title', async () => {
    renderAgenda({ checkItems: [item({ slot: 6 })] });

    await userEvent.click(screen.getByLabelText('View "Dit is een test"'));

    expect(screen.getByLabelText('Title')).toHaveValue('Dit is een test');
  });

  it('persists a description edited in the dialog', async () => {
    const update = vi.fn();
    renderAgenda({ checkItems: [item({ slot: 6 })], update });

    await userEvent.click(screen.getByLabelText('View "Dit is een test"'));
    await userEvent.type(screen.getByLabelText('Description'), 'x');

    expect(
      applied(update, day({ checkItems: [item({ slot: 6 })] })).checkItems[0].description,
    ).toBe('x');
  });
});
