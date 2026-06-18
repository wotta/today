import { useEffect, useRef, useState, type FocusEvent } from 'react';
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
  }, [editor, value, editing]);

  // Move focus into the editor when the user activates edit mode.
  useEffect(() => {
    if (editing) editor.focus();
  }, [editing, editor]);

  // Serialize back to markdown, persist if it actually changed, then drop back
  // to the read view. Markdown export adds a trailing newline, so compare and
  // store trimmed to keep round-trips stable (no spurious saves).
  const save = () => {
    const markdown = editor.blocksToMarkdownLossy().trimEnd();
    if (markdown !== value.trimEnd()) onChange(markdown);
    seededRef.current = markdown;
    setEditing(false);
  };

  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    // Save only when focus leaves the field entirely — not when it moves
    // between elements inside the editor (toolbar, menus, etc.).
    if (editing && !e.currentTarget.contains(e.relatedTarget)) save();
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
      onBlur={handleBlur}
      className={
        'today-rich-description mt-4 min-h-[12rem] w-full rounded-lg border py-1 text-[15px] leading-relaxed outline-none ' +
        (editing
          ? 'border-stone-300 dark:border-stone-600'
          : 'cursor-text border-stone-200 dark:border-stone-700') +
        ' bg-stone-50 text-stone-700 dark:bg-stone-900/40 dark:text-stone-200'
      }
    >
      {empty ? (
        <p className="px-3 py-3 text-stone-300 dark:text-stone-600">Add a description…</p>
      ) : (
        <BlockNoteView editor={editor} editable={editing} theme={isDark ? 'dark' : 'light'} />
      )}
    </div>
  );
}
