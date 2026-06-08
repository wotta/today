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
