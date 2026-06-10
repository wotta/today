import type { ReactNode } from 'react';

/**
 * The "Logical Note" (ロジカルノート) ruled writing surface, reproduced in pure
 * SVG/CSS so it stays crisp at any zoom and themes with the page.
 *
 * The ruling is three-tier: a solid baseline every {@link SHEET_ROW}px with two
 * fainter dotted guides at ⅓ and ⅔. Faint vertical guides every {@link CELL}px
 * align paragraphs, and small tick marks (メモリ) sit in the top and bottom
 * margins. Everything is deliberately *very* quiet — present when you look for
 * it, invisible when you're writing.
 *
 * All lines draw with `currentColor`, so a single text color on the container
 * (light/dark) drives the whole sheet; opacity differentiates the tiers.
 */

/** Baseline spacing (px). Text on the sheet should use this as its line-height
 * so lines sit on the ruling. */
export const SHEET_ROW = 28;
const ROW = SHEET_ROW;
/** Vertical guide spacing (px): every 3 ruled rows, like the source notebook. */
const CELL = ROW * 3;
/** Margin tick (メモリ) spacing (px). Denser than the verticals: one per row width. */
const TICK = ROW;

interface Props {
  children?: ReactNode;
  className?: string;
  /**
   * Unique id for the SVG pattern. Only matters when more than one sheet is
   * mounted at once (duplicate ids would both resolve to the first).
   */
  patternId?: string;
}

export function RuledSheet({ children, className = '', patternId = 'ruled' }: Props) {
  return (
    <div className={'relative bg-[#fcfcfb] dark:bg-stone-900 ' + className}>
      {/* The ruling itself — a tiled SVG pattern filling the sheet. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-slate-400 dark:text-slate-500"
        aria-hidden
      >
        <defs>
          <pattern
            id={patternId}
            width={CELL}
            height={ROW}
            patternUnits="userSpaceOnUse"
            shapeRendering="crispEdges"
          >
            {/* solid baseline */}
            <line x1="0" y1="0.5" x2={CELL} y2="0.5" stroke="currentColor" strokeOpacity="0.22" />
            {/* dotted thirds */}
            <line
              x1="0"
              y1={ROW / 3}
              x2={CELL}
              y2={ROW / 3}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeDasharray="1 3.5"
            />
            <line
              x1="0"
              y1={(2 * ROW) / 3}
              x2={CELL}
              y2={(2 * ROW) / 3}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeDasharray="1 3.5"
            />
            {/* faint vertical guide */}
            <line x1="0.5" y1="0" x2="0.5" y2={ROW} stroke="currentColor" strokeOpacity="0.05" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      {/* Margin tick marks (メモリ) — short strokes every TICK, top and bottom. */}
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

      <div className="relative">{children}</div>
    </div>
  );
}

/** Short vertical ticks every TICK px, drawn with currentColor at low opacity. */
const tickStyle: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px ' + TICK + 'px)',
  opacity: 0.12,
};
