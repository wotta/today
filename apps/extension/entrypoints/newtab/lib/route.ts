import { useEffect, useState } from 'react';
import { AGENDA_END_HOUR, AGENDA_START_HOUR } from '@today/types';

/**
 * Hash-based routing for the new-tab SPA:
 *   #/                     planner (default; any unknown hash falls back here)
 *   #/note/<date>          per-day note page
 *   #/note/<date>/<hour>   per-slot note page
 */
export type Route = { view: 'planner' } | { view: 'note'; date: string; hour?: number };

const NOTE_RE = /^\/note\/(\d{4}-\d{2}-\d{2})(?:\/(\d{1,2}))?$/;

export function parseRoute(hash: string): Route {
  const m = hash.replace(/^#/, '').match(NOTE_RE);
  if (m) {
    const hour = m[2] === undefined ? undefined : Number(m[2]);
    if (hour === undefined || (hour >= AGENDA_START_HOUR && hour <= AGENDA_END_HOUR)) {
      return { view: 'note', date: m[1], hour };
    }
  }
  return { view: 'planner' };
}

/** Hash for a day note, or a slot note when an hour is given. */
export function noteHash(date: string, hour?: number): string {
  return hour === undefined ? `#/note/${date}` : `#/note/${date}/${hour}`;
}

/** True once this session has navigated planner → note, so back is safe. */
let navigatedWithinApp = false;

/** The current route, kept in sync with the location hash. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHashChange = () => {
      const next = parseRoute(window.location.hash);
      setRoute((prev) => {
        if (prev.view === 'planner' && next.view === 'note') navigatedWithinApp = true;
        return next;
      });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return route;
}

/**
 * Leave a note page. history.back() (which restores planner state) is only
 * safe when the planner itself navigated here — on a direct/external open the
 * previous history entry isn't ours, so jump home instead.
 */
export function closeNote(): void {
  if (navigatedWithinApp) {
    window.history.back();
  } else {
    window.location.hash = '';
  }
}
