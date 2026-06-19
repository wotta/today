import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checklist } from '../entrypoints/newtab/components/Checklist';
import type { CheckItem, DayEntry } from '../entrypoints/newtab/lib/types';

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
  text: 'Buy milk',
  done: false,
  order: 0,
  ...over,
});

const day = (over: Partial<DayEntry> = {}): DayEntry => ({
  date: '2026-06-16',
  checkItems: [item()],
  agenda: {},
  ...over,
});

/** Apply the mutate fn captured from an `update` call to a starting day. */
function applied(update: ReturnType<typeof vi.fn>, prev: DayEntry): DayEntry {
  expect(update).toHaveBeenCalledOnce();
  return update.mock.calls[0][0](prev);
}

function renderChecklist(props: Partial<React.ComponentProps<typeof Checklist>> = {}) {
  return render(<Checklist items={[item()]} update={vi.fn()} {...props} />);
}

describe('Checklist view dialog', () => {
  it('opens the view dialog and shows the full title', async () => {
    renderChecklist();

    await userEvent.click(screen.getByLabelText('View "Buy milk"'));

    expect(screen.getByLabelText('Title')).toHaveValue('Buy milk');
  });

  it('persists a description edited in the dialog', async () => {
    const update = vi.fn();
    renderChecklist({ update });

    await userEvent.click(screen.getByLabelText('View "Buy milk"'));
    await userEvent.type(screen.getByLabelText('Description'), 'y');

    expect(applied(update, day()).checkItems[0].description).toBe('y');
  });

  it('marks an item that has a description', () => {
    renderChecklist({ items: [item({ description: 'has detail' })] });

    expect(screen.getByLabelText('View "Buy milk"')).toHaveAttribute(
      'title',
      'Has a description',
    );
  });

  it('does not mark an item without a description', () => {
    renderChecklist();

    expect(screen.getByLabelText('View "Buy milk"')).toHaveAttribute('title', 'View details');
  });
});
