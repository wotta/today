import { browser } from 'wxt/browser';

/** Connection settings for the GitHub Gist storage backend. */
export interface GistConfig {
  /** Personal Access Token with the `gist` scope. */
  pat: string;
  /** Id of the private Gist holding `today-data.json`. */
  gistId: string;
}

const PAT_KEY = 'gistPat';
const GIST_ID_KEY = 'gistId';

/**
 * Read the Gist config from extension-local storage. Returns null unless BOTH
 * the PAT and Gist id are present and non-empty, so a half-configured state
 * never activates the Gist backend.
 */
export async function getGistConfig(): Promise<GistConfig | null> {
  const stored = await browser.storage.local.get([PAT_KEY, GIST_ID_KEY]);
  const pat = typeof stored[PAT_KEY] === 'string' ? (stored[PAT_KEY] as string).trim() : '';
  const gistId =
    typeof stored[GIST_ID_KEY] === 'string' ? (stored[GIST_ID_KEY] as string).trim() : '';
  if (!pat || !gistId) return null;
  return { pat, gistId };
}

export async function setGistConfig(config: GistConfig): Promise<void> {
  await browser.storage.local.set({
    [PAT_KEY]: config.pat.trim(),
    [GIST_ID_KEY]: config.gistId.trim(),
  });
}

export async function clearGistConfig(): Promise<void> {
  await browser.storage.local.remove([PAT_KEY, GIST_ID_KEY]);
}

/**
 * Connection settings for an S3-compatible object store (Cloudflare R2, AWS S3,
 * MinIO, …) used to upload files from the BlockNote editor. Uploads are signed
 * in the browser (SigV4) with these credentials, so prefer a bucket-scoped
 * token: it lives in extension-local storage, like the Gist PAT.
 */
export interface S3Config {
  /** S3 API endpoint, e.g. `https://<account>.r2.cloudflarestorage.com`. */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** SigV4 region. R2 ignores it — `auto` is the right default there. */
  region: string;
  /** Public base URL files are served from, e.g. `https://pub-xxxx.r2.dev`. */
  publicBaseUrl: string;
}

const S3_KEYS = {
  endpoint: 's3Endpoint',
  bucket: 's3Bucket',
  accessKeyId: 's3AccessKeyId',
  secretAccessKey: 's3SecretAccessKey',
  region: 's3Region',
  publicBaseUrl: 's3PublicBaseUrl',
} as const;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Read the object-store config from extension-local storage. Returns null
 * unless every field needed to both upload and serve a file is present, so a
 * half-configured store never enables broken uploads. `region` falls back to
 * `auto` (correct for R2) when blank.
 */
export async function getS3Config(): Promise<S3Config | null> {
  const stored = await browser.storage.local.get(Object.values(S3_KEYS));
  const endpoint = str(stored[S3_KEYS.endpoint]).replace(/\/+$/, '');
  const bucket = str(stored[S3_KEYS.bucket]);
  const accessKeyId = str(stored[S3_KEYS.accessKeyId]);
  const secretAccessKey = str(stored[S3_KEYS.secretAccessKey]);
  const publicBaseUrl = str(stored[S3_KEYS.publicBaseUrl]).replace(/\/+$/, '');
  const region = str(stored[S3_KEYS.region]) || 'auto';
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region, publicBaseUrl };
}

export async function setS3Config(config: S3Config): Promise<void> {
  await browser.storage.local.set({
    [S3_KEYS.endpoint]: config.endpoint.trim().replace(/\/+$/, ''),
    [S3_KEYS.bucket]: config.bucket.trim(),
    [S3_KEYS.accessKeyId]: config.accessKeyId.trim(),
    [S3_KEYS.secretAccessKey]: config.secretAccessKey.trim(),
    [S3_KEYS.region]: config.region.trim() || 'auto',
    [S3_KEYS.publicBaseUrl]: config.publicBaseUrl.trim().replace(/\/+$/, ''),
  });
}

export async function clearS3Config(): Promise<void> {
  await browser.storage.local.remove(Object.values(S3_KEYS));
}

const REMINDERS_KEY = 'remindersEnabled';

/** Whether slot reminders fire. Defaults to on; the options page can disable them. */
export async function getRemindersEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get([REMINDERS_KEY]);
  return stored[REMINDERS_KEY] !== false;
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  await browser.storage.local.set({ [REMINDERS_KEY]: enabled });
}

const SLOT_MINUTES_KEY = 'agendaSlotMinutes';

/** Agenda drop granularity in minutes. 60 = on-the-hour only (the default). */
export type AgendaSlotMinutes = 60 | 30 | 15;

/**
 * How finely the agenda lets you drop an item within an hour: 60 (on the hour),
 * 30 (e.g. 14:30), or 15 (e.g. 14:15). Opt-in — defaults to 60 so the agenda
 * stays on-the-hour unless the user picks finer placement.
 */
export async function getAgendaSlotMinutes(): Promise<AgendaSlotMinutes> {
  const stored = await browser.storage.local.get([SLOT_MINUTES_KEY]);
  const value = stored[SLOT_MINUTES_KEY];
  return value === 30 || value === 15 ? value : 60;
}

export async function setAgendaSlotMinutes(minutes: AgendaSlotMinutes): Promise<void> {
  await browser.storage.local.set({ [SLOT_MINUTES_KEY]: minutes });
}
