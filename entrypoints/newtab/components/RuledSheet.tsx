import type { ReactNode } from 'react';

/**
 * The "Logical Note" (ロジカルノート) ruled writing surface, reproduced in pure
 * SVG/CSS so it stays crisp at any zoom and themes with the page.
 *
 * The ruling is three-tier: a solid baseline every {@link ROW}px with two fainter
 * dotted guides at ⅓ and ⅔ (the lower band is where small text / English
 * lowercase sits). Faint vertical guides every {@link CELL}px align paragraphs and
 * double as a table grid. Small tick marks (メモリ) sit in the top and bottom
 * margins, and a "Date" field tops the page — both lifted from the notebook.
 *
 * All lines draw with `currentColor`, so a single text color on the container
 * (light/dark) drives the whole sheet; opacity differentiates the three tiers.
 */

/** Baseline spacing (px). Thirds fall at ROW/3 and 2·ROW/3. */
const ROW = 28;
/** Vertical guide spacing (px). Equal to ROW for a square table grid. */
const CELL = 28;

interface Props {
  children?: ReactNode;
  className?: string;
  /** Show the "Date" field in the top-right margin. Default true. */
  showDate?: boolean;
  /**
   * Unique id for the SVG pattern. Only matters when more than one sheet is
   * mounted at once (duplicate ids would both resolve to the first).
   */
  patternId?: string;
}

export function RuledSheet({
  children,
  className = '',
  showDate = true,
  patternId = 'ruled',
}: Props) {
  return (
    <div
      className={
        'relative bg-[#fcfcfb] text-slate-400 dark:bg-stone-900 dark:text-slate-500 ' +
        className
      }
    >
      {/* The ruling itself — a tiled SVG pattern filling the sheet. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern
            id={patternId}
            width={CELL}
            height={ROW}
            patternUnits="userSpaceOnUse"
            shapeRendering="crispEdges"
          >
            {/* solid baseline */}
            <line x1="0" y1="0.5" x2={CELL} y2="0.5" stroke="currentColor" strokeOpacity="0.5" />
            {/* dotted thirds */}
            <line
              x1="0"
              y1={ROW / 3}
              x2={CELL}
              y2={ROW / 3}
              stroke="currentColor"
              strokeOpacity="0.32"
              strokeDasharray="1 3.5"
            />
            <line
              x1="0"
              y1={(2 * ROW) / 3}
              x2={CELL}
              y2={(2 * ROW) / 3}
              stroke="currentColor"
              strokeOpacity="0.32"
              strokeDasharray="1 3.5"
            />
            {/* faint vertical guide */}
            <line x1="0.5" y1="0" x2="0.5" y2={ROW} stroke="currentColor" strokeOpacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      {/* Margin tick marks (メモリ) — short strokes every CELL, top and bottom. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[6px] text-slate-400 dark:text-slate-500"
        style={tickStyle}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[6px] text-slate-400 dark:text-slate-500"
        style={tickStyle}
      />

      {/* "Date" field, top-right. */}
      {showDate && (
        <div className="pointer-events-none absolute right-8 top-6 flex items-end gap-2 text-slate-400 dark:text-slate-500">
          <span className="text-[11px] tracking-wide">Date</span>
          <span className="block h-px w-28 bg-current opacity-50" />
        </div>
      )}

      <div className="relative">{children}</div>
    </div>
  );
}

/** Short vertical ticks every CELL px, drawn with currentColor at low opacity. */
const tickStyle: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px ' + CELL + 'px)',
  opacity: 0.28,
};
