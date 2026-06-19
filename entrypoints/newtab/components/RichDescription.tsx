import { useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { getUploadFile, type UploadFile } from '../lib/upload';
import {
  clearDescriptionDraft,
  getDescriptionDraft,
  setDescriptionDraft,
} from '../lib/drafts';

/**
 * Jira-style rich description: a read view that renders the stored markdown as
 * formatted content, which turns into an editable BlockNote editor when focused.
 * Edits are committed only on an explicit Save (button or ⌘/Ctrl+Enter); Cancel
 * discards them.
 *
 * Uncommitted edits are parked as a per-item draft in extension-local storage,
 * so they survive closing the dialog or the whole new-tab page. When a draft
 * exists the field opens straight into edit mode with an "Unsaved draft" badge,
 * so it's always clear there's uncommitted content.
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
  /** Stable id (the check item id) used to key the draft in storage. */
  draftId: string;
}

/** How long to wait after the last keystroke before parking the draft. */
const DRAFT_DEBOUNCE_MS = 400;

/**
 * Resolve the upload config and any saved draft before creating the editor —
 * both are fixed at creation time (the upload handler can't be added later, and
 * a restored draft decides whether we open in edit mode). Until the (local)
 * storage reads resolve we render the box's footprint so the dialog doesn't jump.
 */
export default function RichDescription(props: Props) {
  const [boot, setBoot] = useState<{
    uploadFile: UploadFile | null;
    initialDraft: string | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getUploadFile(), getDescriptionDraft(props.draftId)]).then(
      ([uploadFile, draft]) => {
        if (!active) return;
        // Only treat it as a draft if it differs from what's committed.
        const initialDraft =
          draft != null && draft.trimEnd() !== props.value.trimEnd() ? draft : null;
        setBoot({ uploadFile, initialDraft });
      },
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per open
  }, []);

  if (!boot) {
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
  return (
    <DescriptionEditor
      {...props}
      uploadFile={boot.uploadFile ?? undefined}
      initialDraft={boot.initialDraft}
    />
  );
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
  draftId,
  initialDraft,
}: Props & { uploadFile?: UploadFile; initialDraft: string | null }) {
  const editor = useCreateBlockNote({ uploadFile });
  // A restored draft means we open mid-edit, with the badge showing.
  const [editing, setEditing] = useState(initialDraft != null);
  const [hasDraft, setHasDraft] = useState(initialDraft != null);
  const isDark = useIsDark();

  // The latest editor content as markdown, kept in sync on every keystroke so
  // we can park it without reading the (possibly tearing-down) editor view.
  const latestRef = useRef((initialDraft ?? value).trimEnd());

  // BlockNote also fires onChange when the editor flips to read-only (on Save),
  // so we gate draft writes on actually editing to avoid re-parking a draft we
  // just committed and cleared.
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Seed the editor from the draft (if resuming) or the stored value, and focus
  // it if we open mid-edit. This runs via onMount — touching editor.document /
  // replaceBlocks / focus before the ProseMirror view is mounted throws "view
  // not available", which StrictMode's double-mount made reliable.
  useEffect(() => {
    return editor.onMount(() => {
      const initial = initialDraft ?? value;
      const blocks = editor.tryParseMarkdownToBlocks(initial);
      if (blocks.length) editor.replaceBlocks(editor.document, blocks);
      if (editingRef.current) editor.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on (re)mount
  }, [editor]);

  // Focus when the user activates edit mode on an already-mounted editor.
  useEffect(() => {
    if (editing && editor.domElement) editor.focus();
  }, [editing, editor]);

  // Park (or clear) the draft. A draft equal to the committed value isn't an
  // unsaved change, so we drop it and hide the badge.
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const writeDraft = (markdown: string) => {
    if (markdown === value.trimEnd()) {
      setHasDraft(false);
      void clearDescriptionDraft(draftId);
    } else {
      setHasDraft(true);
      void setDescriptionDraft(draftId, markdown);
    }
  };

  // Flush the pending draft on unmount so the last keystrokes survive closing
  // the dialog. Writes straight to storage (no setState — we're unmounting).
  // Kept in a ref so the cleanup always runs the latest closure.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    clearTimeout(draftTimer.current);
    if (editing && latestRef.current !== value.trimEnd()) {
      void setDescriptionDraft(draftId, latestRef.current);
    }
  };
  useEffect(() => () => flushRef.current(), []);

  const save = () => {
    clearTimeout(draftTimer.current);
    const markdown = latestRef.current;
    if (markdown !== value.trimEnd()) onChange(markdown);
    void clearDescriptionDraft(draftId);
    setHasDraft(false);
    setEditing(false);
  };

  // Discard: drop the draft and restore the editor to the committed markdown.
  const cancel = () => {
    clearTimeout(draftTimer.current);
    if (editor.domElement) {
      const blocks = editor.tryParseMarkdownToBlocks(value);
      editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: 'paragraph' }]);
    }
    latestRef.current = value.trimEnd();
    void clearDescriptionDraft(draftId);
    setHasDraft(false);
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
            if (!editingRef.current) return;
            const markdown = editor.blocksToMarkdownLossy().trimEnd();
            latestRef.current = markdown;
            clearTimeout(draftTimer.current);
            draftTimer.current = setTimeout(() => writeDraft(markdown), DRAFT_DEBOUNCE_MS);
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
          {hasDraft ? (
            <span className="ml-auto flex select-none items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved draft
            </span>
          ) : (
            <span className="ml-auto select-none text-[11px] text-stone-400 dark:text-stone-500">
              ⌘/Ctrl+Enter to save
            </span>
          )}
        </div>
      )}
    </div>
  );
}
