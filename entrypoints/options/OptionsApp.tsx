import { useEffect, useState } from 'react';
import {
  clearGistConfig,
  getGistConfig,
  setGistConfig,
} from '../newtab/lib/settings';
import { GistError, createGist, findGistWithData, verifyGist } from '../newtab/lib/gist';
import { SERVER_BASE } from '../newtab/lib/api';

type Status =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'connected'; gistId: string }
  | { kind: 'error'; message: string };

// Opens GitHub's "new token" page with a name filled in and the `gist` scope
// already ticked, so the user just has to click Generate.
const NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?description=Today%20planner&scopes=gist';

// Best-effort: tell the local helper server to use the same Gist, so the MCP
// tools read/write the same data. The server may be down — that's fine, the
// extension still works on its own.
async function pushServerConfig(pat: string, gistId: string): Promise<void> {
  try {
    await fetch(`${SERVER_BASE}/api/gist-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pat, gistId }),
    });
  } catch {
    /* server not running; ignore */
  }
}

async function clearServerConfig(): Promise<void> {
  try {
    await fetch(`${SERVER_BASE}/api/gist-config`, { method: 'DELETE' });
  } catch {
    /* server not running; ignore */
  }
}

function messageFor(err: unknown): string {
  if (err instanceof GistError) {
    if (err.kind === 'unauthorized') return 'Invalid token — check the PAT has gist scope';
    if (err.kind === 'not-found') return 'Gist not found — check the Gist ID';
    if (err.kind === 'rate-limited') return 'GitHub rate limit hit — try again shortly';
  }
  return 'Could not reach GitHub — check your connection';
}

export function OptionsApp() {
  const [pat, setPat] = useState('');
  const [gistId, setGistId] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Pre-fill from any existing config.
  useEffect(() => {
    void getGistConfig().then((config) => {
      if (!config) return;
      setPat(config.pat);
      setGistId(config.gistId);
      setStatus({ kind: 'connected', gistId: config.gistId });
    });
  }, []);

  const save = async () => {
    const trimmedPat = pat.trim();
    if (!trimmedPat) return;
    setStatus({ kind: 'connecting' });
    try {
      const existing = gistId.trim();
      let id: string;
      if (existing) {
        await verifyGist(trimmedPat, existing);
        id = existing;
      } else {
        // Reuse an existing today-data.json gist before creating a new one, so
        // connecting a second device doesn't spawn a duplicate. (This call also
        // validates the PAT.)
        id = (await findGistWithData(trimmedPat)) ?? (await createGist(trimmedPat));
      }
      await setGistConfig({ pat: trimmedPat, gistId: id });
      void pushServerConfig(trimmedPat, id);
      setGistId(id);
      setStatus({ kind: 'connected', gistId: id });
    } catch (err) {
      setStatus({ kind: 'error', message: messageFor(err) });
    }
  };

  const disconnect = async () => {
    await clearGistConfig();
    void clearServerConfig();
    setPat('');
    setGistId('');
    setStatus({ kind: 'idle' });
  };

  const connecting = status.kind === 'connecting';

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-12 text-stone-800 dark:bg-stone-950 dark:text-stone-100">
      <main className="mx-auto w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h1 className="text-lg font-semibold tracking-tight">GitHub Gist sync</h1>
        <p className="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">
          Sync your planner to a private GitHub Gist. Requires a Personal Access Token with the{' '}
          <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">gist</code> scope.
        </p>

        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Personal Access Token
            <input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="ghp_…"
              autoComplete="off"
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800"
            />
            <a
              href={NEW_TOKEN_URL}
              target="_blank"
              rel="noreferrer"
              className="self-start text-[12px] font-normal text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
            >
              Create a token with the gist scope →
            </a>
          </label>

          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Gist ID <span className="font-normal text-stone-400">(optional — leave blank to create one)</span>
            <input
              type="text"
              value={gistId}
              onChange={(e) => setGistId(e.target.value)}
              placeholder="e.g. 1a2b3c4d…"
              autoComplete="off"
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!pat.trim() || connecting}
              className="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
            >
              {connecting ? 'Connecting…' : 'Save'}
            </button>
            {status.kind === 'connected' && (
              <button
                type="button"
                onClick={() => void disconnect()}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-stone-400 dark:border-stone-600 dark:text-stone-300"
              >
                Disconnect
              </button>
            )}
          </div>
        </form>

        <StatusLine status={status} />
      </main>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'connecting') {
    return <p className="mt-4 text-[13px] text-stone-500">Connecting…</p>;
  }
  if (status.kind === 'connected') {
    return (
      <p className="mt-4 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
        Connected — gist: <code>{status.gistId}</code>
      </p>
    );
  }
  return (
    <p className="mt-4 text-[13px] font-medium text-red-600 dark:text-red-400">{status.message}</p>
  );
}
