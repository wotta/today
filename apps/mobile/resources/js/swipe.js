// Carousel-style day swipe. Instead of sliding the current day off to a blank
// background, we lay the previous and next days out as side panels in a track
// and drag the whole track, so the day you're swiping toward slides in under
// your finger. Releasing past the threshold animates to that panel and commits
// the navigation; otherwise it snaps back.
//
// Neighbour panels are fetched lazily (same local data, so effectively instant)
// and Alpine renders their content just like the live page.

const THRESHOLD = 100; // px of horizontal travel to commit the day change
const LOCK = 18; // px of intent before the gesture is judged horizontal vs vertical

export function initSwipe() {
    const main = document.querySelector('[data-swipe]');
    if (!main) return null;

    // Touch-only enhancement; desktop keeps the plain page.
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return null;

    const prevUrl = main.dataset.prev || '';
    const nextUrl = main.dataset.next || '';
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Build the carousel: viewport (clips horizontally) > track (flex row) >
    // [prev][current][next] panels, each one viewport wide.
    const viewport = main.parentElement;
    viewport.style.overflowX = 'clip';
    viewport.style.position = 'relative';

    const track = document.createElement('div');
    track.style.display = 'flex';
    track.style.willChange = 'transform';

    const panel = () => {
        const p = document.createElement('div');
        p.style.flex = '0 0 100%';
        p.style.minWidth = '0';
        return p;
    };
    const left = panel();
    const center = panel();
    const right = panel();
    // Neighbours are previews — don't let taps land in them mid-swipe.
    left.style.pointerEvents = 'none';
    right.style.pointerEvents = 'none';

    center.appendChild(main); // move the live day into the middle
    track.append(left, center, right);
    viewport.appendChild(track);

    let W = viewport.clientWidth;
    const setX = (px, animate) => {
        track.style.transition = animate && !reduce ? 'transform 0.22s ease' : 'none';
        track.style.transform = `translateX(${px}px)`;
    };
    setX(-W, false); // center the current day

    // Lazily load a neighbour's rendered planner into its panel.
    const fill = (slot, url) => {
        if (!url) return;
        fetch(url)
            .then((r) => r.text())
            .then((html) => {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const m = doc.querySelector('[data-swipe]');
                if (!m) return;
                m.removeAttribute('data-swipe'); // not a swipe root, just a preview
                slot.appendChild(m); // Alpine renders its content on insert
            })
            .catch(() => {});
    };
    fill(left, prevUrl);
    fill(right, nextUrl);

    let x0 = 0;
    let y0 = 0;
    let dx = 0;
    let axis = null; // null | 'h' | 'v'

    viewport.addEventListener(
        'touchstart',
        (e) => {
            if (e.touches.length !== 1) return;
            W = viewport.clientWidth;
            x0 = e.touches[0].clientX;
            y0 = e.touches[0].clientY;
            dx = 0;
            axis = null;
            setX(-W, false);
        },
        { passive: true },
    );

    viewport.addEventListener(
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
                e.preventDefault(); // own the horizontal gesture; let vertical scroll
                // Start the slide from the activation point so the panel doesn't
                // jump by LOCK px the moment the axis locks.
                let d = dx - Math.sign(dx) * LOCK;
                // Resist dragging toward an edge with no day to show.
                if ((d > 0 && !prevUrl) || (d < 0 && !nextUrl)) d *= 0.2;
                setX(-W + d, false);
            }
        },
        { passive: false },
    );

    viewport.addEventListener('touchend', () => {
        if (axis !== 'h') return;

        const goNext = dx < 0 && nextUrl;
        const goPrev = dx > 0 && prevUrl;

        if (Math.abs(dx) > THRESHOLD && (goNext || goPrev)) {
            const target = goNext ? nextUrl : prevUrl;
            setX(goNext ? -2 * W : 0, true); // slide the neighbour fully in
            const nav = () => (window.location.href = target);
            if (reduce) {
                nav();
            } else {
                let done = false;
                const finish = () => {
                    if (done) return;
                    done = true;
                    track.removeEventListener('transitionend', finish);
                    nav();
                };
                track.addEventListener('transitionend', finish);
                setTimeout(finish, 320); // fallback if transitionend doesn't fire
            }
        } else {
            setX(-W, true); // snap back
        }
        axis = null;
        dx = 0;
    });

    // Expose the viewport so pull-to-refresh can nudge the whole carousel down
    // (the track itself carries swipe's horizontal transform, so we move its
    // parent instead).
    return viewport;
}
