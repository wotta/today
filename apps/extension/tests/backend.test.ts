import { beforeEach, describe, expect, it, vi } from 'vitest';

const getGistConfig = vi.hoisted(() => vi.fn());

vi.mock('../entrypoints/newtab/lib/settings', () => ({ getGistConfig }));
vi.mock('../entrypoints/newtab/lib/api', () => ({
  CLIENT_ID: 'c',
  fetchDay: vi.fn(async () => 'from-api'),
  putDay: vi.fn(),
  beaconDay: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock('../entrypoints/newtab/lib/gist', () => ({
  fetchDay: vi.fn(async () => 'from-gist'),
  putDay: vi.fn(),
  beaconDay: vi.fn(),
  subscribe: vi.fn(),
}));

import * as backend from '../entrypoints/newtab/lib/backend';
import * as api from '../entrypoints/newtab/lib/api';
import * as gist from '../entrypoints/newtab/lib/gist';

beforeEach(() => {
  vi.clearAllMocks();
  backend.__resetBackend();
});

it('routes to the local server when no Gist config exists', async () => {
  getGistConfig.mockResolvedValue(null);

  const result = await backend.fetchDay('2026-06-08');

  expect(result).toBe('from-api');
  expect(api.fetchDay).toHaveBeenCalledWith('2026-06-08');
  expect(gist.fetchDay).not.toHaveBeenCalled();
});

it('routes to the Gist backend when a config exists', async () => {
  getGistConfig.mockResolvedValue({ pat: 'tok', gistId: 'gid' });

  const result = await backend.fetchDay('2026-06-08');

  expect(result).toBe('from-gist');
  expect(gist.fetchDay).toHaveBeenCalledWith('2026-06-08');
  expect(api.fetchDay).not.toHaveBeenCalled();
});
