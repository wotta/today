// Theme: 'light' | 'dark' | 'auto'. Persisted in localStorage; 'auto' follows the
// device's prefers-color-scheme live. The actual light/dark switch is the `dark`
// class on <html>, which the Tailwind `dark:` variant keys off (see app.css).
//
// A tiny no-FOUC bootstrap in the <head> applies the stored theme before paint;
// this module owns runtime changes (toggle + live system updates).

const STORAGE_KEY = 'today:theme';

export function getTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
}

export function systemPrefersDark() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Resolve a theme choice to the concrete mode actually shown. */
export function resolved(theme = getTheme()) {
    if (theme === 'auto') return systemPrefersDark() ? 'dark' : 'light';
    return theme;
}

export function applyTheme(theme = getTheme()) {
    const dark = resolved(theme) === 'dark';
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
}

export function setTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent('today:theme-changed', { detail: { theme } }));
}

// Keep 'auto' in sync when the OS flips appearance while the app is open.
const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
mq?.addEventListener?.('change', () => {
    if (getTheme() === 'auto') applyTheme('auto');
});

// Reflect the active choice on any segmented theme control:
//   <button data-set-theme="light|auto|dark"> ... </button>
function syncControls() {
    const current = getTheme();
    document.querySelectorAll('[data-set-theme]').forEach((el) => {
        el.setAttribute('aria-pressed', String(el.dataset.setTheme === current));
    });
}

function initControls() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-set-theme]');
        if (!btn) return;
        setTheme(btn.dataset.setTheme);
        syncControls();
    });
    syncControls();
}

window.addEventListener('today:theme-changed', syncControls);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initControls);
} else {
    initControls();
}

// Apply once on load (covers the case where the head bootstrap didn't run).
applyTheme();
