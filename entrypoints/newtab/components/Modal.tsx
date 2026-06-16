import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
  /** id of the element labelling the dialog, for aria-labelledby. */
  labelledBy?: string;
  children: ReactNode;
}

/**
 * A centered overlay panel. Closes on backdrop click and on Escape, and moves
 * focus into the panel when it opens. Rendered through a portal so it stacks
 * above the page regardless of where it's used.
 */
export function Modal({ onClose, labelledBy, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      // mousedown (not click) so a text selection that drifts onto the backdrop
      // doesn't dismiss the dialog.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-xl border border-stone-200 bg-white p-6 shadow-xl outline-none dark:border-stone-700 dark:bg-stone-800"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
