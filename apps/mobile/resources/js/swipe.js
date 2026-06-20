// Horizontal swipe to change day on the planner. Drag the card left -> next
// day, right -> previous day; release past the threshold navigates, otherwise
// it snaps back. Axis is locked on the first significant move so vertical
// scrolling is never hijacked.

const THRESHOLD = 70; // px of horizontal travel needed to commit
const LOCK = 10; // px before we decide the gesture is horizontal vs vertical

export function initSwipe() {
    const el = document.querySelector('[data-swipe]');
    if (!el) return;

    const prevUrl = el.dataset.prev || '';
    const nextUrl = el.dataset.next || '';
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let x0 = 0;
    let y0 = 0;
    let dx = 0;
    let axis = null; // null | 'h' | 'v'

    const reset = () => {
        axis = null;
        dx = 0;
    };

    el.addEventListener(
        'touchstart',
        (e) => {
            if (e.touches.length !== 1) return;
            x0 = e.touches[0].clientX;
            y0 = e.touches[0].clientY;
            axis = null;
            dx = 0;
            el.style.transition = 'none';
        },
        { passive: true },
    );

    el.addEventListener(
        'touchmove',
        (e) => {
            if (e.touches.length !== 1) return;
            dx = e.touches[0].clientX - x0;
            const dy = e.touches[0].clientY - y0;

            if (axis === null) {
                if (Math.abs(dx) > LOCK && Math.abs(dx) > Math.abs(dy)) axis = 'h';
                else if (Math.abs(dy) > LOCK) axis = 'v';
            }

            if (axis === 'h') {
                e.preventDefault(); // stop the page from scrolling during a horizontal drag
                // Resist dragging toward an edge that has nowhere to go.
                const target = dx < 0 ? nextUrl : prevUrl;
                const factor = target ? 0.6 : 0.2;
                el.style.transform = `translateX(${dx * factor}px)`;
                el.style.opacity = String(Math.max(0.5, 1 - Math.abs(dx) / 800));
            }
        },
        { passive: false },
    );

    el.addEventListener('touchend', () => {
        if (axis !== 'h') {
            reset();
            return;
        }

        const target = dx < 0 ? nextUrl : prevUrl;
        const committed = Math.abs(dx) > THRESHOLD && target;

        el.style.transition = reduce ? 'none' : 'transform 0.18s ease, opacity 0.18s ease';

        if (committed) {
            // Slide the card the rest of the way out, then navigate.
            const out = dx < 0 ? -window.innerWidth : window.innerWidth;
            el.style.transform = `translateX(${out}px)`;
            el.style.opacity = '0';
            const go = () => (window.location.href = target);
            if (reduce) go();
            else setTimeout(go, 150);
        } else {
            el.style.transform = 'translateX(0)';
            el.style.opacity = '1';
        }
        reset();
    });
}
