// Pull remote Gist changes (extension / other devices) into the open planner.
// iOS won't run a background task reliably, so the pull is foreground-driven:
// on resume (visibilitychange), on a slow safety-net interval, and on demand via
// pull-to-refresh (see pulldown.js). The endpoint is cheap — a conditional GET
// returns 304 when nothing changed.
//
// On a real change it broadcasts `today:synced` with { changed, days }; each
// planner panel listens (see planner.applySync) and patches its own date.

// 5 minutes. The interval is just a safety net — pull-to-refresh covers the
// "I want it now" case, so we poll the network rarely to spare battery/quota.
const INTERVAL_MS = 5 * 60 * 1000;

/** Run one pull. Resolves once the response is applied (or skipped/failed). */
export async function syncNow() {
    try {
        const res = await fetch('/api/sync', { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.changed) && data.changed.length > 0) {
            window.dispatchEvent(new CustomEvent('today:synced', { detail: data }));
        }
    } catch (e) {
        // Offline / transient — a later trigger retries.
    }
}

export function startGistSync() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) syncNow();
    });
    setInterval(() => {
        if (!document.hidden) syncNow();
    }, INTERVAL_MS);
    syncNow();
}
