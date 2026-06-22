interface Props {
  online: boolean;
  /** Backend label shown when connected (e.g. "Gist"). Defaults to the local server. */
  label?: string;
}

/** Subtle bottom-left indicator of whether the active storage backend is reachable. */
export function SyncStatus({ online, label }: Props) {
  const onlineText = label ? `${label} synced` : 'Synced';
  const offlineText = label ? `${label} offline` : 'Offline';
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-stone-400 shadow-sm backdrop-blur dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-500"
      title={
        label
          ? online
            ? `Connected to your GitHub Gist — changes sync to ${label}.`
            : `${label} unreachable — edits are saved locally and will sync when it is back.`
          : online
            ? 'Connected to the Today helper server — changes sync to your AI tools.'
            : 'Helper server not running — edits are saved locally and will sync when it is back.'
      }
    >
      <span
        className={
          'h-2 w-2 rounded-full ' + (online ? 'bg-emerald-500' : 'bg-amber-500')
        }
      />
      {online ? onlineText : offlineText}
    </div>
  );
}
