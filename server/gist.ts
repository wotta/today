import type { DayEntry } from './types';
import type { GistConfig } from './config';

const API = 'https://api.github.com';
const GIST_FILE = 'today-data.json';

interface Envelope {
  version: 1;
  exportedAt: string;
  days: Record<string, DayEntry>;
}

function headers(pat: string): Record<string, string> {
  return { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' };
}

/** Read the full `days` map from the Gist's today-data.json. */
export async function loadDays(cfg: GistConfig): Promise<Record<string, DayEntry>> {
  const res = await fetch(`${API}/gists/${cfg.gistId}`, { headers: headers(cfg.pat) });
  if (!res.ok) throw new Error(`gist load failed: ${res.status}`);
  const gist = (await res.json()) as {
    files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }>;
  };
  const file = gist.files[GIST_FILE];
  if (!file) return {};
  // GitHub truncates large file content in the gist response; fetch the raw blob.
  const text =
    file.truncated && file.raw_url ? await (await fetch(file.raw_url)).text() : (file.content ?? '');
  try {
    return (JSON.parse(text) as Partial<Envelope>).days ?? {};
  } catch {
    return {};
  }
}

/** Write the full `days` map back to the Gist as a versioned envelope. */
export async function saveDays(cfg: GistConfig, days: Record<string, DayEntry>): Promise<void> {
  const envelope: Envelope = { version: 1, exportedAt: new Date().toISOString(), days };
  const res = await fetch(`${API}/gists/${cfg.gistId}`, {
    method: 'PATCH',
    headers: { ...headers(cfg.pat), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: { [GIST_FILE]: { content: JSON.stringify(envelope, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`gist save failed: ${res.status}`);
}
