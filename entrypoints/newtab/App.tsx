import { useState } from 'react';
import { DateHeader } from './components/DateHeader';
import { Checklist } from './components/Checklist';
import { Agenda } from './components/Agenda';
import { ThemeToggle } from './components/ThemeToggle';
import { SyncStatus } from './components/SyncStatus';
import { ConnectButton } from './components/ConnectButton';
import { useDay } from './lib/useDay';
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
  const [date, setDate] = useState<string>(() => todayKey());
  const { entry, update, online } = useDay(date);
  const { theme, setTheme } = useTheme();
  useDateShortcuts(setDate);

  return (
    <div className="flex min-h-full justify-center px-4 py-10">
      {/* Centered notebook page */}
      <main className="w-full max-w-xl rounded-sm border border-stone-200 bg-[#fcfcfb] px-8 py-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] dark:border-stone-700 dark:bg-stone-900 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_12px_32px_-12px_rgba(0,0,0,0.6)]">
        <DateHeader date={date} onDateChange={setDate} />
        <Checklist items={entry.checkItems} update={update} />
        <div className="mt-8">
          <Agenda
            agenda={entry.agenda}
            update={update}
            currentHour={currentAgendaHour(date)}
          />
        </div>
      </main>

      <div className="fixed bottom-4 left-4 z-10 flex items-center gap-2">
        <SyncStatus online={online} />
        <ConnectButton />
      </div>
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </div>
  );
}

export default App;
