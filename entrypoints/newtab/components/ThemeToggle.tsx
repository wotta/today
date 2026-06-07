import type { Theme } from '../lib/theme';

interface Props {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export function ThemeToggle({ theme, setTheme }: Props) {
  return (
    <div
      role="group"
      aria-label="Color theme"
      className="fixed bottom-4 right-4 z-10 flex gap-0.5 rounded-full border border-stone-200 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-stone-700 dark:bg-stone-800/80"
    >
      <ToggleButton
        active={theme === 'light'}
        label="Light mode"
        onClick={() => setTheme('light')}
      >
        <SunIcon />
      </ToggleButton>
      <ToggleButton
        active={theme === 'dark'}
        label="Dark mode"
        onClick={() => setTheme('dark')}
      >
        <MoonIcon />
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={
        'flex h-8 w-8 items-center justify-center rounded-full transition-colors ' +
        (active
          ? 'bg-stone-800 text-stone-50 dark:bg-stone-100 dark:text-stone-900'
          : 'text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200')
      }
    >
      {children}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
