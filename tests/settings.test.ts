import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory chrome.storage.local stand-in.
const store = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: async (keys: string[]) => {
          const out: Record<string, unknown> = {};
          for (const k of keys) if (k in store.data) out[k] = store.data[k];
          return out;
        },
        set: async (items: Record<string, unknown>) => {
          Object.assign(store.data, items);
        },
        remove: async (keys: string[]) => {
          for (const k of keys) delete store.data[k];
        },
      },
    },
  },
}));

import {
  clearGistConfig,
  getGistConfig,
  setGistConfig,
} from '../entrypoints/newtab/lib/settings';

beforeEach(() => {
  store.data = {};
});

describe('getGistConfig', () => {
  it('returns null when nothing is stored', async () => {
    expect(await getGistConfig()).toBeNull();
  });

  it('returns null when only one of PAT / Gist id is present', async () => {
    await setGistConfig({ pat: 'tok', gistId: '' });
    expect(await getGistConfig()).toBeNull();
  });

  it('returns the config when both fields are present', async () => {
    store.data = { gistPat: 'tok', gistId: 'abc123' };
    expect(await getGistConfig()).toEqual({ pat: 'tok', gistId: 'abc123' });
  });
});

describe('setGistConfig / clearGistConfig', () => {
  it('round-trips through storage', async () => {
    await setGistConfig({ pat: 'tok', gistId: 'abc123' });
    expect(await getGistConfig()).toEqual({ pat: 'tok', gistId: 'abc123' });
  });

  it('clears both fields', async () => {
    await setGistConfig({ pat: 'tok', gistId: 'abc123' });
    await clearGistConfig();
    expect(await getGistConfig()).toBeNull();
  });
});
