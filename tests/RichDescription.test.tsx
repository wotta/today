import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A faithful stand-in for the BlockNote editor: it round-trips markdown the way
// the real editor does (parse on seed, serialize on save) and notifies its view
// when content changes, so we can test RichDescription's read/edit/save logic
// without running ProseMirror under jsdom.
const h = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const editor = {
    _md: '',
    document: [] as unknown[],
    tryParseMarkdownToBlocks(md: string) {
      return md ? [{ text: md }] : [];
    },
    replaceBlocks(_remove: unknown, insert: { text: string }[]) {
      this._md = insert.map((b) => b.text).join('\n');
      listeners.forEach((l) => l());
    },
    blocksToMarkdownLossy() {
      return this._md;
    },
    setMarkdown(md: string) {
      this._md = md;
      listeners.forEach((l) => l());
    },
    focus: vi.fn(),
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    reset() {
      this._md = '';
      this.focus.mockClear();
      listeners.clear();
    },
  };
  return { editor };
});

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: () => h.editor,
}));

vi.mock('@blocknote/mantine', async () => {
  const { useEffect, useReducer } = await import('react');
  return {
    // editable -> an input bound to the editor's markdown; read-only -> the
    // rendered content. Both subscribe so a seed/replace re-renders the view.
    BlockNoteView: ({ editable }: { editable: boolean }) => {
      const [, force] = useReducer((x: number) => x + 1, 0);
      useEffect(() => {
        const unsubscribe = h.editor.subscribe(force);
        return () => {
          unsubscribe();
        };
      }, []);
      return editable ? (
        <textarea
          aria-label="blocknote"
          value={h.editor._md}
          onChange={(e) => h.editor.setMarkdown(e.target.value)}
        />
      ) : (
        <div data-testid="rendered">{h.editor._md}</div>
      );
    },
  };
});

// No object store configured in these tests — uploads are covered separately.
vi.mock('../entrypoints/newtab/lib/upload', () => ({ getUploadFile: vi.fn(async () => null) }));

import RichDescription from '../entrypoints/newtab/components/RichDescription';

beforeEach(() => h.editor.reset());

describe('RichDescription', () => {
  it('renders the stored markdown as formatted content in read mode', async () => {
    render(<RichDescription value="hello world" onChange={vi.fn()} ariaLabel="Description" />);

    await waitFor(() => expect(screen.getByTestId('rendered')).toHaveTextContent('hello world'));
    expect(screen.queryByLabelText('blocknote')).not.toBeInTheDocument();
  });

  it('activates the editable editor when the field is focused', async () => {
    render(<RichDescription value="seed" onChange={vi.fn()} ariaLabel="Description" />);

    // Wait for the upload-config lookup to resolve and the editor to mount.
    await screen.findByTestId('rendered');
    await userEvent.click(screen.getByLabelText('Description'));

    expect(await screen.findByLabelText('blocknote')).toBeInTheDocument();
    expect(h.editor.focus).toHaveBeenCalled();
  });

  it('persists the edited content as markdown on blur', async () => {
    const onChange = vi.fn();
    // A stateful host mirrors the real dialog: the saved markdown flows back in
    // as the new value, so the field returns to read mode showing it.
    function Host() {
      const [value, setValue] = useState('seed');
      return (
        <>
          <RichDescription
            value={value}
            onChange={(markdown) => {
              onChange(markdown);
              setValue(markdown);
            }}
            ariaLabel="Description"
          />
          <button type="button">outside</button>
        </>
      );
    }
    render(<Host />);

    await screen.findByTestId('rendered');
    await userEvent.click(screen.getByLabelText('Description'));
    const input = await screen.findByLabelText('blocknote');
    await userEvent.clear(input);
    await userEvent.type(input, 'edited markdown');
    await userEvent.click(screen.getByText('outside'));

    expect(onChange).toHaveBeenLastCalledWith('edited markdown');
    // Back to read mode showing the saved content.
    expect(await screen.findByTestId('rendered')).toHaveTextContent('edited markdown');
  });

  it('does not persist when the content is unchanged', async () => {
    const onChange = vi.fn();
    render(
      <>
        <RichDescription value="seed" onChange={onChange} ariaLabel="Description" />
        <button type="button">outside</button>
      </>,
    );

    await screen.findByTestId('rendered');
    await userEvent.click(screen.getByLabelText('Description'));
    await screen.findByLabelText('blocknote');
    await userEvent.click(screen.getByText('outside'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
