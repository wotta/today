import { useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { getUploadFile, type UploadFile } from '../lib/upload';

/**
 * Jira-style rich description: a read view that renders the stored markdown as
 * formatted content, which turns into an editable BlockNote editor the moment
 * it's focused. On blur the edited content is serialized back to markdown and
 * persisted, and the field returns to the read view.
 *
 * The whole module — BlockNote and its ProseMirror deps — is lazy-loaded from
 * {@link ./CheckItemDialog}, so the planner view never pays for it.
 */

interface Props {
  /** Stored markdown. */
  value: string;
  /** Called with the new markdown when an edit is saved. */
  onChange: (markdown: string) => void;
  ariaLabel: string;
}

/**
 * Resolve whether file uploads are configured before creating the editor — the
 * upload handler is fixed at creation time, so we can't add it later. The read
 * is a single (local) storage lookup; until it resolves we render the box's
 * footprint so the dialog doesn't jump.
 */
export default function RichDescription(props: Props) {
  const [upload, setUpload] = useState<{ fn: UploadFile | null } | null>(null);
  useEffect(() => {
    let active = true;
    void getUploadFile().then((fn) => {
      if (active) setUpload({ fn });
    });
    return () => {
      active = false;
    };
  }, []);

  if (!upload) {
    return (
      <div
        aria-label={props.ariaLabel}
        className="today-rich-description mt-4 min-h-[12rem] w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-stone-700 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-200"
      >
        {props.value.trim() || (
          <span className="text-stone-300 dark:text-stone-600">Add a description…</span>
        )}
      </div>
    );
  }
  return <DescriptionEditor {...props} uploadFile={upload.fn ?? undefined} />;
}

/** Track the app's dark mode (the `dark` class on <html>) so BlockNote's chrome
 * matches the surrounding theme and follows the user's toggle while open. */
function useIsDark(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const root = document.documentElement;
    const obs = new MutationObserver(() => setDark(root.classList.contains('dark')));
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function DescriptionEditor({
  value,
  onChange,
  ariaLabel,
  uploadFile,
}: Props & { uploadFile?: UploadFile }) {
  const editor = useCreateBlockNote({ uploadFile });
  const [editing, setEditing] = useState(false);
  const isDark = useIsDark();

  // The latest editor content as markdown, kept in sync on every keystroke so
  // we can persist without reading the (possibly tearing-down) editor view.
  const latestRef = useRef(value.trimEnd());

  // Seed the editor from the stored markdown — on mount and whenever the value
  // changes from outside (e.g. a remote sync) while we're not actively editing,
  // so we never clobber what the user is typing. An empty value leaves the
  // editor's default empty paragraph in place (and avoids touching the
  // ProseMirror view before it has mounted).
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (editing || seededRef.current === value) return;
    const blocks = editor.tryParseMarkdownToBlocks(value);
    if (blocks.length) editor.replaceBlocks(editor.document, blocks);
    seededRef.current = value;
    latestRef.current = value.trimEnd();
  }, [editor, value, editing]);

  // Move focus into the editor when the user activates edit mode.
  useEffect(() => {
    if (editing) editor.focus();
  }, [editing, editor]);

  // Persist the edited markdown if it actually changed. Markdown export adds a
  // trailing newline, so compare and store trimmed to keep round-trips stable
  // (no spurious saves). Kept in a ref so the unmount flush below always calls
  // the current closure.
  const persist = () => {
    const markdown = latestRef.current;
    if (markdown !== value.trimEnd()) onChange(markdown);
    seededRef.current = markdown;
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Edits are committed only on an explicit Save (button or ⌘/Ctrl+Enter), so
  // clicking away no longer stores anything. But if the dialog is closed while
  // editing, flush the pending content on unmount so work is never lost.
  useEffect(
    () => () => {
      if (editingRef.current) persistRef.current();
    },
    [],
  );

  const save = () => {
    persist();
    setEditing(false);
  };

  // Discard edits: restore the editor to the stored markdown, then read mode.
  const cancel = () => {
    const blocks = editor.tryParseMarkdownToBlocks(value);
    editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: 'paragraph' }]);
    latestRef.current = value.trimEnd();
    seededRef.current = value;
    setEditing(false);
  };

  const empty = !editing && value.trim() === '';

  return (
    <div
      aria-label={ariaLabel}
      tabIndex={editing ? -1 : 0}
      onFocus={() => {
        if (!editing) setEditing(true);
      }}
      onClick={() => {
        if (!editing) setEditing(true);
      }}
      onKeyDown={(e) => {
        if (editing && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          save();
        }
      }}
      className={
        'today-rich-description mt-4 min-h-[12rem] w-full rounded-lg border text-[15px] leading-relaxed outline-none ' +
        (editing
          ? 'border-stone-300 dark:border-stone-600'
          : 'cursor-text border-stone-200 dark:border-stone-700') +
        ' bg-stone-50 text-stone-700 dark:bg-stone-900/40 dark:text-stone-200'
      }
    >
      {empty ? (
        <p className="px-3 py-3 text-stone-300 dark:text-stone-600">Add a description…</p>
      ) : (
        <BlockNoteView
          editor={editor}
          editable={editing}
          theme={isDark ? 'dark' : 'light'}
          onChange={() => {
            latestRef.current = editor.blocksToMarkdownLossy().trimEnd();
          }}
        />
      )}

      {editing && (
        <div className="flex items-center gap-2 border-t border-stone-200 px-3 py-2 dark:border-stone-700">
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-stone-800 px-3 py-1 text-[13px] font-medium text-stone-50 transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded-md px-3 py-1 text-[13px] font-medium text-stone-500 transition-colors hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
          >
            Cancel
          </button>
          <span className="ml-auto select-none text-[11px] text-stone-400 dark:text-stone-500">
            ⌘/Ctrl+Enter to save
          </span>
        </div>
      )}
    </div>
  );
}
