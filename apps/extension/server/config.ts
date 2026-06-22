import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/** Gist connection settings, mirroring the extension's GistConfig. */
export interface GistConfig {
  pat: string;
  gistId: string;
}

export const CONFIG_PATH = process.env.TODAY_CONFIG
  ? path.resolve(process.env.TODAY_CONFIG)
  : path.join(os.homedir(), '.today', 'config.json');

let current: GistConfig | null = null;

function normalize(cfg: Partial<GistConfig> | null | undefined): GistConfig | null {
  const pat = typeof cfg?.pat === 'string' ? cfg.pat.trim() : '';
  const gistId = typeof cfg?.gistId === 'string' ? cfg.gistId.trim() : '';
  return pat && gistId ? { pat, gistId } : null;
}

/** Load config from disk once at startup. Env vars (if both set) take precedence. */
export async function loadConfig(): Promise<void> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    current = normalize(JSON.parse(raw) as Partial<GistConfig>);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('today: could not read config file:', err);
    }
    current = null;
  }
  const env = normalize({ pat: process.env.TODAY_GIST_PAT, gistId: process.env.TODAY_GIST_ID });
  if (env) current = env;
}

/** The active Gist config, or null when running in local-file mode. */
export function getGistConfig(): GistConfig | null {
  return current;
}

export async function setGistConfig(cfg: GistConfig): Promise<void> {
  const next = normalize(cfg);
  if (!next) throw new Error('pat and gistId are required');
  current = next;
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
}

export async function clearGistConfig(): Promise<void> {
  current = null;
  await fs.rm(CONFIG_PATH, { force: true });
}
