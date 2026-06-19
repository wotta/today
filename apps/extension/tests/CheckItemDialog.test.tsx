import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckItemDialog } from '../entrypoints/newtab/components/CheckItemDialog';
import type { CheckItem } from '@today/types';

// The real description editor lazy-loads BlockNote (ProseMirror), which doesn't
// run under jsdom; its own behaviour is covered in RichDescription.test.tsx.
// Here we stub it with a plain textarea so we can assert how the dialog wires
// the stored markdown in and persisted markdown back out.
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
  text: 'Ticket aanmaken voor EA settings pagina',
  done: false,
  order: 0,
  ...over,
});

function renderDialog(props: Partial<React.ComponentProps<typeof CheckItemDialog>> = {}) {
  return render(
    <CheckItemDialog item={item()} onChange={vi.fn()} onClose={vi.fn()} {...props} />,
  );
}

describe('CheckItemDialog', () => {
  it('shows the full title and description', async () => {
    renderDialog({ item: item({ description: 'long form detail here' }) });

    expect(screen.getByLabelText('Title')).toHaveValue('Ticket aanmaken voor EA settings pagina');
    expect(await screen.findByLabelText('Description')).toHaveValue('long form detail here');
  });

  it('edits the title', async () => {
    const onChange = vi.fn();
    renderDialog({ onChange });

    await userEvent.type(screen.getByLabelText('Title'), '!');

    expect(onChange).toHaveBeenLastCalledWith({
      text: 'Ticket aanmaken voor EA settings pagina!',
    });
  });

  it('persists the edited description as markdown', async () => {
    const onChange = vi.fn();
    renderDialog({ onChange });

    await userEvent.type(await screen.findByLabelText('Description'), 'x');

    expect(onChange).toHaveBeenLastCalledWith({ description: 'x' });
  });

  it('toggles done', async () => {
    const onChange = vi.fn();
    renderDialog({ onChange });

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenLastCalledWith({ done: true });
  });

  it('closes on the close button and on Escape', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    await userEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
