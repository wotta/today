interface Props {
  online: boolean;
}

/** Subtle bottom-left indicator of whether the helper server is reachable. */
export function SyncStatus({ online }: Props) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-stone-400 shadow-sm backdrop-blur dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-500"
      title={
        online
          ? 'Connected to the Today helper server — changes sync to your AI tools.'
          : 'Helper server not running — edits are saved locally and will sync when it is back.'
      }
    >
      <span
        className={
          'h-2 w-2 rounded-full ' + (online ? 'bg-emerald-500' : 'bg-amber-500')
        }
      />
      {online ? 'Synced' : 'Offline'}
    </div>
  );
}
