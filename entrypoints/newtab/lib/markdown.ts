import MarkdownIt from 'markdown-it';

/**
 * Note rendering. `html: false` (the default) escapes raw HTML in the source,
 * so notes can't inject markup — no separate sanitizer needed. `breaks` makes a
 * single newline a line break, matching how you'd write on ruled paper.
 */
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

export function renderMarkdown(src: string): string {
  return md.render(src);
}
