// Pull-to-refresh. Drag down from the top of the page to force a Gist sync —
// the on-demand counterpart to the slow background interval in sync.js.
//
// Listens at the document level (vertical scroll lives on the window, and
// initSwipe() reparents the planner element). Only engages on a vertical-down
// gesture that starts at scroll-top, and requires the drag to be more vertical
// than horizontal so it never steals a left/right day-swipe (see swipe.js).

import { syncNow } from './sync';

const DEADZONE = 24; // px of slack before the pull starts following the finger
const TRIGGER = 90; // px of (resisted) travel past the deadzone needed to fire
const MAX = 130; // px cap on travel

export function initPullToRefresh(content = null) {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    // Planner page only — nothing to refresh elsewhere (e.g. settings).
    if (!document.querySelector('[data-swipe]')) return;

    // Spinner keyframes (injected once, keeps this module self-contained).
    const style = document.createElement('style');
    style.textContent = '@keyframes today-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);

    const indicator = document.createElement('div');
    indicator.style.cssText =
        'position:fixed;left:0;right:0;top:0;display:flex;justify-content:center;' +
        'pointer-events:none;z-index:50;opacity:0;transition:opacity .2s ease;';
    const spinner = document.createElement('div');
    spinner.style.cssText =
        'margin-top:calc(env(safe-area-inset-top) + 10px);width:26px;height:26px;' +
        'border-radius:9999px;border:2px solid rgba(120,113,108,.25);' +
        'border-top-color:rgba(120,113,108,.9);';
    indicator.appendChild(spinner);
    document.body.appendChild(indicator);

    let startX = 0;
    let startY = 0;
    let active = false; // this gesture is a downward pull from the top
    let dist = 0;
    let busy = false; // a refresh is in flight

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    // Move the planner (and indicator) by `px`. animate=true eases the snap.
    const offset = (px, animate) => {
        if (content) {
            content.style.transition = animate ? 'transform .25s ease' : 'none';
            content.style.transform = px ? `translateY(${px}px)` : '';
        }
        indicator.style.transition = animate ? 'opacity .2s ease, transform .25s ease' : 'opacity .2s ease';
        indicator.style.opacity = String(Math.min(px / TRIGGER, 1));
        spinner.style.transform = `rotate(${px * 3}deg)`;
    };
    const settle = () => offset(0, true);

    document.addEventListener(
        'touchstart',
        (e) => {
            if (busy || e.touches.length !== 1) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            active = atTop();
            dist = 0;
        },
        { passive: true },
    );

    document.addEventListener(
        'touchmove',
        (e) => {
            if (!active || busy || e.touches.length !== 1) return;
            const dy = e.touches[0].clientY - startY;
            const dx = e.touches[0].clientX - startX;

            // Bail on an upward move, a horizontal swipe, or once scrolled away.
            if (dy <= 0 || Math.abs(dx) > dy || !atTop()) {
                active = false;
                settle();
                return;
            }

            e.preventDefault(); // suppress native overscroll while pulling

            // Dead-zone: swallow the first few px so a small over-scroll doesn't
            // start dragging the page — only past it does content follow.
            if (dy <= DEADZONE) {
                dist = 0;
                offset(0, false);
                return;
            }

            dist = Math.min((dy - DEADZONE) * 0.5, MAX); // resistance past the deadzone
            offset(dist, false); // content follows the finger
        },
        { passive: false },
    );

    document.addEventListener('touchend', async () => {
        if (!active || busy) {
            settle();
            active = false;
            return;
        }
        active = false;

        if (dist < TRIGGER) {
            settle();
            return;
        }

        busy = true;
        offset(TRIGGER, true); // hold the planner open while we refresh
        spinner.style.animation = 'today-spin .8s linear infinite';
        try {
            await syncNow();
        } finally {
            busy = false;
            spinner.style.animation = '';
            settle();
        }
    });
}
