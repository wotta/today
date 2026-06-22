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
  clearDescriptionDraft,
  getDescriptionDraft,
  setDescriptionDraft,
} from '../entrypoints/newtab/lib/drafts';

beforeEach(() => {
  store.data = {};
});

describe('description drafts', () => {
  it('returns null when no draft is stored', async () => {
    expect(await getDescriptionDraft('item-1')).toBeNull();
  });

  it('round-trips a draft, keyed per item', async () => {
    await setDescriptionDraft('item-1', '# wip');
    await setDescriptionDraft('item-2', 'other');

    expect(await getDescriptionDraft('item-1')).toBe('# wip');
    expect(await getDescriptionDraft('item-2')).toBe('other');
  });

  it('clears a draft without touching others', async () => {
    await setDescriptionDraft('item-1', 'a');
    await setDescriptionDraft('item-2', 'b');

    await clearDescriptionDraft('item-1');

    expect(await getDescriptionDraft('item-1')).toBeNull();
    expect(await getDescriptionDraft('item-2')).toBe('b');
  });
});
