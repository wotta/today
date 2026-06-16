import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckItemDialog } from '../entrypoints/newtab/components/CheckItemDialog';
import type { CheckItem } from '../entrypoints/newtab/lib/types';

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
  it('shows the full title and description', () => {
    renderDialog({ item: item({ description: 'long form detail here' }) });

    expect(screen.getByLabelText('Title')).toHaveValue('Ticket aanmaken voor EA settings pagina');
    expect(screen.getByLabelText('Description')).toHaveValue('long form detail here');
  });

  it('edits the title', async () => {
    const onChange = vi.fn();
    renderDialog({ onChange });

    await userEvent.type(screen.getByLabelText('Title'), '!');

    expect(onChange).toHaveBeenLastCalledWith({
      text: 'Ticket aanmaken voor EA settings pagina!',
    });
  });

  it('edits the description', async () => {
    const onChange = vi.fn();
    renderDialog({ onChange });

    await userEvent.type(screen.getByLabelText('Description'), 'x');

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
