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
    // The real editor only mounts its ProseMirror view once BlockNoteView is in
    // the DOM; mirror that with a truthy domElement and an onMount that fires
    // immediately (the view is "ready" as soon as we register).
    domElement: {} as unknown,
    onMount(cb: () => void) {
      cb();
      return () => {};
    },
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
  return { editor, drafts: new Map<string, string>() };
});

vi.mock('@blocknote/react', () => ({
  useCreateBlockNote: () => h.editor,
}));

vi.mock('@blocknote/mantine', async () => {
  const { useEffect, useReducer } = await import('react');
  return {
    // editable -> an input bound to the editor's markdown; read-only -> the
    // rendered content. Both subscribe so a seed/replace re-renders the view.
    BlockNoteView: ({ editable, onChange }: { editable: boolean; onChange?: () => void }) => {
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
          onChange={(e) => {
            h.editor.setMarkdown(e.target.value);
            onChange?.();
          }}
        />
      ) : (
        <div data-testid="rendered">{h.editor._md}</div>
      );
    },
  };
});

// No object store configured in these tests — uploads are covered separately.
vi.mock('../entrypoints/newtab/lib/upload', () => ({ getUploadFile: vi.fn(async () => null) }));

// In-memory draft store so we can assert what gets parked/cleared.
vi.mock('../entrypoints/newtab/lib/drafts', () => ({
  getDescriptionDraft: vi.fn(async (id: string) => (h.drafts.has(id) ? h.drafts.get(id) : null)),
  setDescriptionDraft: vi.fn(async (id: string, md: string) => {
    h.drafts.set(id, md);
  }),
  clearDescriptionDraft: vi.fn(async (id: string) => {
    h.drafts.delete(id);
  }),
}));

import RichDescription from '../entrypoints/newtab/components/RichDescription';

beforeEach(() => {
  h.editor.reset();
  h.drafts.clear();
});

describe('RichDescription', () => {
  it('renders the stored markdown as formatted content in read mode', async () => {
    render(
      <RichDescription value="hello world" onChange={vi.fn()} ariaLabel="Description" draftId="a" />,
    );

    await waitFor(() => expect(screen.getByTestId('rendered')).toHaveTextContent('hello world'));
    expect(screen.queryByLabelText('blocknote')).not.toBeInTheDocument();
  });

  it('activates the editable editor when the field is focused', async () => {
    render(<RichDescription value="seed" onChange={vi.fn()} ariaLabel="Description" draftId="a" />);

    // Wait for the boot lookups to resolve and the editor to mount.
    await screen.findByTestId('rendered');
    await userEvent.click(screen.getByLabelText('Description'));

    expect(await screen.findByLabelText('blocknote')).toBeInTheDocument();
    expect(h.editor.focus).toHaveBeenCalled();
  });

  // A stateful host mirrors the real dialog: a saved value flows back in as the
  // new value, so the field returns to read mode showing it.
  function renderHosted(onChange: (markdown: string) => void, initial = 'seed') {
    function Host() {
      const [value, setValue] = useState(initial);
      return (
        <>
          <RichDescription
            value={value}
            onChange={(markdown) => {
              onChange(markdown);
              setValue(markdown);
            }}
            ariaLabel="Description"
            draftId="a"
          />
          <button type="button">outside</button>
        </>
      );
    }
    return render(<Host />);
  }

  async function enterEdit() {
    await screen.findByTestId('rendered');
    await userEvent.click(screen.getByLabelText('Description'));
    return screen.findByLabelText('blocknote');
  }

  it('persists and returns to read mode when Save is clicked', async () => {
    const onChange = vi.fn();
    renderHosted(onChange);

    const input = await enterEdit();
    await userEvent.clear(input);
    await userEvent.type(input, 'edited markdown');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange).toHaveBeenLastCalledWith('edited markdown');
    expect(await screen.findByTestId('rendered')).toHaveTextContent('edited markdown');
    expect(h.drafts.has('a')).toBe(false); // draft cleared on save
  });

  it('saves on ⌘/Ctrl+Enter', async () => {
    const onChange = vi.fn();
    renderHosted(onChange);

    const input = await enterEdit();
    await userEvent.clear(input);
    await userEvent.type(input, 'via shortcut');
    await userEvent.type(input, '{Control>}{Enter}{/Control}');

    expect(onChange).toHaveBeenLastCalledWith('via shortcut');
    expect(await screen.findByTestId('rendered')).toBeInTheDocument();
  });

  it('stays in edit mode and does not commit when focus leaves', async () => {
    const onChange = vi.fn();
    renderHosted(onChange);

    const input = await enterEdit();
    await userEvent.clear(input);
    await userEvent.type(input, 'work in progress');
    await userEvent.click(screen.getByText('outside'));

    // Still editing — no commit, no revert.
    expect(screen.getByLabelText('blocknote')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('discards the draft and reverts when Cancel is clicked', async () => {
    const onChange = vi.fn();
    renderHosted(onChange);

    const input = await enterEdit();
    await userEvent.clear(input);
    await userEvent.type(input, 'throwaway');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByTestId('rendered')).toHaveTextContent('seed');
    expect(h.drafts.has('a')).toBe(false);
  });

  it('does not persist when Save is clicked without changes', async () => {
    const onChange = vi.fn();
    renderHosted(onChange);

    await enterEdit();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('parks a draft as you type and shows the unsaved-draft badge', async () => {
    const onChange = vi.fn();
    renderHosted(onChange);

    const input = await enterEdit();
    await userEvent.clear(input);
    await userEvent.type(input, 'in-progress notes');

    await waitFor(() => expect(h.drafts.get('a')).toBe('in-progress notes'));
    expect(screen.getByText('Unsaved draft')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled(); // not committed
  });

  it('flushes the draft (not a commit) when closed mid-edit', async () => {
    const onChange = vi.fn();
    const { unmount } = renderHosted(onChange);

    const input = await enterEdit();
    await userEvent.clear(input);
    await userEvent.type(input, 'unsaved but closing');
    unmount();

    expect(h.drafts.get('a')).toBe('unsaved but closing');
    expect(onChange).not.toHaveBeenCalled(); // description is untouched
  });

  it('restores a saved draft on open, in edit mode with the badge', async () => {
    h.drafts.set('a', 'a draft from last time');

    render(<RichDescription value="seed" onChange={vi.fn()} ariaLabel="Description" draftId="a" />);

    // Opens straight into the editor (no read view), showing the draft content.
    const input = await screen.findByLabelText('blocknote');
    expect(input).toHaveValue('a draft from last time');
    expect(screen.getByText('Unsaved draft')).toBeInTheDocument();
  });
});
