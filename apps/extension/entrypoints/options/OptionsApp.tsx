import { useEffect, useState } from 'react';
import {
  clearGistConfig,
  clearS3Config,
  getAgendaSlotMinutes,
  getGistConfig,
  getRemindersEnabled,
  getS3Config,
  setAgendaSlotMinutes,
  setGistConfig,
  setRemindersEnabled,
  setS3Config,
  type AgendaSlotMinutes,
  type S3Config,
} from '../newtab/lib/settings';
import { GistError, createGist, findGistWithData, verifyGist } from '../newtab/lib/gist';
import { testUpload } from '../newtab/lib/upload';
import { SERVER_BASE } from '../newtab/lib/api';
import { browser } from 'wxt/browser';

const EMPTY_S3: S3Config = {
  endpoint: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  region: 'auto',
  publicBaseUrl: '',
};

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
  const [reminders, setReminders] = useState(true);
  const [slotMinutes, setSlotMinutes] = useState<AgendaSlotMinutes>(60);

  // Pre-fill from any existing config.
  useEffect(() => {
    void getGistConfig().then((config) => {
      if (!config) return;
      setPat(config.pat);
      setGistId(config.gistId);
      setStatus({ kind: 'connected', gistId: config.gistId });
    });
    void getRemindersEnabled().then(setReminders);
    void getAgendaSlotMinutes().then(setSlotMinutes);
  }, []);

  const toggleReminders = (enabled: boolean) => {
    setReminders(enabled);
    void setRemindersEnabled(enabled);
  };

  const changeSlotMinutes = (minutes: AgendaSlotMinutes) => {
    setSlotMinutes(minutes);
    void setAgendaSlotMinutes(minutes);
  };

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
      <main className="mx-auto w-full max-w-xl rounded-lg border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
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

        <section className="mt-6 border-t border-stone-200 pt-5 dark:border-stone-700">
          <h2 className="text-lg font-semibold tracking-tight">Reminders</h2>
          <p className="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">
            Get a browser notification 10 minutes before an agenda slot with unfinished
            checklist items.
          </p>
          <label className="mt-3 flex items-center gap-2 text-[13px] font-medium">
            <input
              type="checkbox"
              checked={reminders}
              onChange={(e) => toggleReminders(e.target.checked)}
              className="h-4 w-4 accent-stone-800 dark:accent-stone-100"
            />
            Notify me before scheduled items
          </label>
        </section>

        <section className="mt-6 border-t border-stone-200 pt-5 dark:border-stone-700">
          <h2 className="text-lg font-semibold tracking-tight">Agenda</h2>
          <p className="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">
            How finely you can drop an item within an hour — e.g. pin it to 14:30 or
            14:15 instead of only on the hour. Reminders follow the same grid.
          </p>
          <label className="mt-3 flex items-center gap-2 text-[13px] font-medium">
            Drop granularity
            <select
              value={slotMinutes}
              onChange={(e) => changeSlotMinutes(Number(e.target.value) as AgendaSlotMinutes)}
              className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800"
            >
              <option value={60}>On the hour</option>
              <option value={30}>Every 30 minutes</option>
              <option value={15}>Every 15 minutes</option>
            </select>
          </label>
        </section>

        <S3Settings />
      </main>
    </div>
  );
}

type S3Status =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'testing' }
  | { kind: 'tested'; url: string }
  | { kind: 'error'; message: string };

const s3InputClass =
  'rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500 dark:border-stone-600 dark:bg-stone-800';

/**
 * Configure an S3-compatible object store (R2, S3, MinIO, …) for file uploads
 * in the rich description editor. Credentials are stored in extension-local
 * storage and uploads are signed in the browser, so a bucket-scoped token is
 * strongly preferred. "Test upload" writes a tiny probe file to surface
 * credential / CORS problems before they bite mid-edit.
 */
function S3Settings() {
  const [config, setConfig] = useState<S3Config>(EMPTY_S3);
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState<S3Status>({ kind: 'idle' });

  useEffect(() => {
    void getS3Config().then((c) => {
      if (c) {
        setConfig(c);
        setConfigured(true);
      }
    });
  }, []);

  const set = (patch: Partial<S3Config>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setStatus({ kind: 'idle' });
  };

  const complete = Boolean(
    config.endpoint.trim() &&
      config.bucket.trim() &&
      config.accessKeyId.trim() &&
      config.secretAccessKey.trim() &&
      config.publicBaseUrl.trim(),
  );

  const save = async () => {
    if (!complete) return;
    await setS3Config(config);
    setConfigured(true);
    setStatus({ kind: 'saved' });
  };

  const test = async () => {
    if (!complete) return;
    setStatus({ kind: 'testing' });
    try {
      await setS3Config(config);
      setConfigured(true);
      const url = await testUpload(config);
      setStatus({ kind: 'tested', url });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Upload failed' });
    }
  };

  const disconnect = async () => {
    await clearS3Config();
    setConfig(EMPTY_S3);
    setConfigured(false);
    setStatus({ kind: 'idle' });
  };

  return (
    <section className="mt-6 border-t border-stone-200 pt-5 dark:border-stone-700">
      <h2 className="text-lg font-semibold tracking-tight">File uploads (S3 / R2)</h2>
      <p className="mt-1 text-[13px] leading-snug text-stone-500 dark:text-stone-400">
        Upload images and files in check-item descriptions to your own bucket. Uploads are signed
        in your browser, so use a <strong>bucket-scoped</strong> token. The bucket needs a CORS
        policy allowing <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">PUT</code> from
        this extension's origin (<code className="rounded bg-stone-100 px-1 dark:bg-stone-800">chrome-extension://…</code>),
        and public read access so saved links keep resolving.
      </p>

      <ExtensionOrigin />

      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          S3 endpoint
          <input
            type="text"
            value={config.endpoint}
            onChange={(e) => set({ endpoint: e.target.value })}
            placeholder="https://<account>.r2.cloudflarestorage.com"
            autoComplete="off"
            className={s3InputClass}
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-[13px] font-medium">
            Bucket
            <input
              type="text"
              value={config.bucket}
              onChange={(e) => set({ bucket: e.target.value })}
              placeholder="my-bucket"
              autoComplete="off"
              className={s3InputClass}
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-[13px] font-medium">
            Region
            <input
              type="text"
              value={config.region}
              onChange={(e) => set({ region: e.target.value })}
              placeholder="auto"
              autoComplete="off"
              className={s3InputClass}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Access key ID
          <input
            type="password"
            value={config.accessKeyId}
            onChange={(e) => set({ accessKeyId: e.target.value })}
            autoComplete="off"
            className={s3InputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Secret access key
          <input
            type="password"
            value={config.secretAccessKey}
            onChange={(e) => set({ secretAccessKey: e.target.value })}
            autoComplete="off"
            className={s3InputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Public base URL
          <input
            type="text"
            value={config.publicBaseUrl}
            onChange={(e) => set({ publicBaseUrl: e.target.value })}
            placeholder="https://pub-xxxx.r2.dev"
            autoComplete="off"
            className={s3InputClass}
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!complete}
            className="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
          >
            Save bucket
          </button>
          <button
            type="button"
            onClick={() => void test()}
            disabled={!complete || status.kind === 'testing'}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-600 dark:text-stone-300"
          >
            {status.kind === 'testing' ? 'Testing…' : 'Test upload'}
          </button>
          {configured && (
            <button
              type="button"
              onClick={() => void disconnect()}
              className="rounded-md px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"
            >
              Disconnect
            </button>
          )}
        </div>
      </form>

      <S3StatusLine status={status} />
    </section>
  );
}

/**
 * Show this extension's own origin (`chrome-extension://<id>`) in a copyable
 * field — it's hard to copy out of chrome://extensions and is exactly what the
 * bucket's CORS `AllowedOrigins` needs.
 */
function ExtensionOrigin() {
  const [copied, setCopied] = useState(false);
  let id = '';
  try {
    id = browser.runtime?.id ?? '';
  } catch {
    id = '';
  }
  if (!id) return null;
  const origin = `chrome-extension://${id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the field is selectable as a fallback */
    }
  };

  return (
    <div className="mt-3">
      <span className="text-[12px] text-stone-500 dark:text-stone-400">
        This extension's origin (add to the bucket's CORS <code>AllowedOrigins</code>):
      </span>
      <div className="mt-1 flex gap-2">
        <input
          readOnly
          aria-label="Extension origin"
          value={origin}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-md border border-stone-300 bg-stone-50 px-3 py-1.5 font-mono text-[12px] text-stone-700 outline-none dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-[12px] font-medium text-stone-600 transition-colors hover:border-stone-400 dark:border-stone-600 dark:text-stone-300"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function S3StatusLine({ status }: { status: S3Status }) {
  if (status.kind === 'saved') {
    return (
      <p className="mt-3 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">Saved.</p>
    );
  }
  if (status.kind === 'tested') {
    return (
      <p className="mt-3 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
        Upload works — test file at <code className="break-all">{status.url}</code>
      </p>
    );
  }
  if (status.kind === 'error') {
    return (
      <p className="mt-3 text-[13px] font-medium text-red-600 dark:text-red-400">{status.message}</p>
    );
  }
  return null;
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
