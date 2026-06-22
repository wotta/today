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
  clearS3Config,
  getGistConfig,
  getRemindersEnabled,
  getS3Config,
  setGistConfig,
  setRemindersEnabled,
  setS3Config,
  type S3Config,
} from '../entrypoints/newtab/lib/settings';

const s3 = (over: Partial<S3Config> = {}): S3Config => ({
  endpoint: 'https://acc.r2.cloudflarestorage.com',
  bucket: 'files',
  accessKeyId: 'AKIA',
  secretAccessKey: 'secret',
  region: 'auto',
  publicBaseUrl: 'https://pub.r2.dev',
  ...over,
});

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

describe('getS3Config', () => {
  it('returns null when nothing is stored', async () => {
    expect(await getS3Config()).toBeNull();
  });

  it('returns null when a required field is missing', async () => {
    await setS3Config(s3({ publicBaseUrl: '' }));
    expect(await getS3Config()).toBeNull();
  });

  it('round-trips a full config and defaults region to auto', async () => {
    await setS3Config(s3({ region: '' }));
    expect(await getS3Config()).toEqual(s3({ region: 'auto' }));
  });

  it('strips trailing slashes from endpoint and public base URL', async () => {
    await setS3Config(s3({ endpoint: 'https://acc.r2.cloudflarestorage.com/', publicBaseUrl: 'https://pub.r2.dev/' }));
    const config = await getS3Config();
    expect(config?.endpoint).toBe('https://acc.r2.cloudflarestorage.com');
    expect(config?.publicBaseUrl).toBe('https://pub.r2.dev');
  });

  it('clears every field', async () => {
    await setS3Config(s3());
    await clearS3Config();
    expect(await getS3Config()).toBeNull();
  });
});

describe('reminders setting', () => {
  it('defaults to enabled', async () => {
    expect(await getRemindersEnabled()).toBe(true);
  });

  it('round-trips through storage', async () => {
    await setRemindersEnabled(false);
    expect(await getRemindersEnabled()).toBe(false);
    await setRemindersEnabled(true);
    expect(await getRemindersEnabled()).toBe(true);
  });
});
