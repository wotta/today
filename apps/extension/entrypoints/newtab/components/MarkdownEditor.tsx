import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { SHEET_ROW } from './RuledSheet';

/**
 * Live styled-source markdown editor (iA-Writer style): what you type is
 * exactly what's stored, and styling is applied on top as you type. Marks stay
 * visible — `# Title` renders as a bold heading with the `#` shown, and turns
 * back into plain text the moment the marks change.
 *
 * Headings keep the body font size step small and every line keeps the sheet's
 * 28px line height, so text always sits on the ruled baselines.
 */

/** Markdown source styling. Colors are mid-stone so they read on both themes.
 * Heading sizes step down per level but always fit the 28px line grid. */
const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '21px' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '18px' },
  { tag: tags.heading3, fontWeight: '700', fontSize: '16px' },
  // h4–h6: body size, still bold — deeper levels rarely make sense in notes.
  { tag: tags.heading, fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontSize: '13px', backgroundColor: 'rgba(120, 113, 108, 0.12)' },
  { tag: tags.quote, color: '#8a8580' },
  { tag: tags.link, textDecoration: 'underline', textUnderlineOffset: '2px' },
  { tag: tags.url, color: '#a8a29e' },
  // The marks themselves (#, **, -, >, `) — visible but receded.
  { tag: tags.processingInstruction, color: '#b3aea8' },
  { tag: tags.labelName, color: '#b3aea8' },
]);

/** Editor chrome: transparent, flush with the sheet, locked to the ruling. */
const sheetTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: `${SHEET_ROW}px`,
  },
  '.cm-content': {
    padding: `${SHEET_ROW * 2}px 32px 32px`,
    fontSize: '15px',
    caretColor: 'currentColor',
    color: 'inherit',
  },
  '.cm-line': { padding: '0' },
  '.cm-placeholder': { color: '#b3aea8' },
});

interface Props {
  value: string;
  onChange: (text: string) => void;
  ariaLabel: string;
}

export function MarkdownEditor({ value, onChange, ariaLabel }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create the editor once; value/onChange flow through refs and transactions.
  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          // base: GFM-ish markdown; addKeymap continues lists/quotes on Enter.
          markdown({ base: markdownLanguage, addKeymap: true }),
          syntaxHighlighting(markdownHighlight),
          sheetTheme,
          EditorView.lineWrapping,
          placeholder('Write…'),
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    view.focus();
    return () => {
      viewRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; sync below.
  }, []);

  // External value changes (remote sync, day switch) replace the doc.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className="min-h-[75vh]" />;
}
