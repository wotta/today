import { useEffect, useRef, useState } from 'react';
import { DateHeader } from './components/DateHeader';
import { Checklist } from './components/Checklist';
import { Agenda } from './components/Agenda';
import { NotePage } from './components/NotePage';
import { ThemeToggle } from './components/ThemeToggle';
import { SyncStatus } from './components/SyncStatus';
import { ConnectButton } from './components/ConnectButton';
import { ImportExport } from './components/ImportExport';
import { useDay } from './lib/useDay';
import { isGistActive } from './lib/backend';
import { useRoute } from './lib/route';
import { useTheme } from './lib/theme';
import { useDateShortcuts } from './lib/useDateShortcuts';
import { todayKey } from './lib/date';
import { AGENDA_END_HOUR, AGENDA_START_HOUR } from './lib/types';

/** The "now" agenda hour for today, mapping 0–2am into the 24–26 range; null if out of range. */
function currentAgendaHour(date: string): number | null {
  if (date !== todayKey()) return null;
  const h = new Date().getHours();
  const mapped = h <= AGENDA_END_HOUR - 24 ? h + 24 : h;
  return mapped >= AGENDA_START_HOUR && mapped <= AGENDA_END_HOUR ? mapped : null;
}

function App() {
  const route = useRoute();
  const [date, setDate] = useState<string>(() => todayKey());
  const { entry, update, online } = useDay(date);
  const { theme, setTheme } = useTheme();
  useDateShortcuts(setDate);

  // Label the sync indicator "Gist" when the GitHub Gist backend is active.
  const [syncLabel, setSyncLabel] = useState<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void isGistActive().then((on) => {
      if (active) setSyncLabel(on ? 'Gist' : undefined);
    });
    return () => {
      active = false;
    };
  }, []);

  // Restore the planner's scroll position when coming back from a note page.
  const plannerScroll = useRef(0);
  const prevView = useRef(route.view);
  useEffect(() => {
    if (prevView.current === route.view) return;
    if (route.view === 'note') {
      plannerScroll.current = window.scrollY;
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, plannerScroll.current);
    }
    prevView.current = route.view;
  }, [route.view]);

  if (route.view === 'note') {
    return (
      <div key={`note-${route.date}-${route.hour ?? 'day'}`} className="page-turn min-h-full">
        <NotePage date={route.date} hour={route.hour} />
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </div>
    );
  }

  return (
    <div key="planner" className="page-turn flex min-h-full justify-center px-4 pt-10 pb-18">
      {/* Centered notebook page */}
      <main className="w-full max-w-xl rounded-sm border border-stone-200 bg-[#fcfcfb] px-8 pb-20 pt-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] dark:border-stone-700 dark:bg-stone-900 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_12px_32px_-12px_rgba(0,0,0,0.6)]">
        <DateHeader date={date} onDateChange={setDate} />
        <Checklist items={entry.checkItems} update={update} />
        <div className="mt-8">
          <Agenda
            agenda={entry.agenda}
            checkItems={entry.checkItems}
            update={update}
            currentHour={currentAgendaHour(date)}
          />
        </div>
      </main>

      <div className="fixed bottom-4 left-4 z-10 flex items-center gap-2">
        <SyncStatus online={online} label={syncLabel} />
        <ConnectButton />
        <ImportExport />
      </div>
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </div>
  );
}

export default App;
