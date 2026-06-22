import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from './msw';

const h = vi.hoisted(() => {
  class GistError extends Error {
    constructor(
      public kind: string,
      public status: number,
    ) {
      super(kind);
      this.name = 'GistError';
    }
  }
  return {
    GistError,
    findGistWithData: vi.fn(async () => null as string | null),
    createGist: vi.fn(async () => 'new-gist-id'),
    verifyGist: vi.fn(async () => {}),
    getGistConfig: vi.fn(async () => null as null | { pat: string; gistId: string }),
    setGistConfig: vi.fn(async () => {}),
    clearGistConfig: vi.fn(async () => {}),
    getRemindersEnabled: vi.fn(async () => true),
    setRemindersEnabled: vi.fn(async () => {}),
    getAgendaSlotMinutes: vi.fn(async () => 60),
    setAgendaSlotMinutes: vi.fn(async () => {}),
    getS3Config: vi.fn(async () => null as null | Record<string, string>),
    setS3Config: vi.fn(async () => {}),
    clearS3Config: vi.fn(async () => {}),
    testUpload: vi.fn(async () => 'https://pub-xxxx.r2.dev/today/abc-today-upload-test.txt'),
  };
});

vi.mock('../entrypoints/newtab/lib/gist', () => ({
  GistError: h.GistError,
  findGistWithData: h.findGistWithData,
  createGist: h.createGist,
  verifyGist: h.verifyGist,
}));
vi.mock('../entrypoints/newtab/lib/settings', () => ({
  getGistConfig: h.getGistConfig,
  setGistConfig: h.setGistConfig,
  clearGistConfig: h.clearGistConfig,
  getRemindersEnabled: h.getRemindersEnabled,
  setRemindersEnabled: h.setRemindersEnabled,
  getAgendaSlotMinutes: h.getAgendaSlotMinutes,
  setAgendaSlotMinutes: h.setAgendaSlotMinutes,
  getS3Config: h.getS3Config,
  setS3Config: h.setS3Config,
  clearS3Config: h.clearS3Config,
}));
vi.mock('../entrypoints/newtab/lib/upload', () => ({ testUpload: h.testUpload }));
vi.mock('wxt/browser', () => ({ browser: { runtime: { id: 'testextensionid' } } }));

import { OptionsApp } from '../entrypoints/options/OptionsApp';

beforeEach(() => {
  vi.clearAllMocks();
  h.findGistWithData.mockResolvedValue(null);
  h.createGist.mockResolvedValue('new-gist-id');
  h.getGistConfig.mockResolvedValue(null);
  h.getS3Config.mockResolvedValue(null);
  h.testUpload.mockResolvedValue('https://pub-xxxx.r2.dev/today/abc-today-upload-test.txt');
  // The form best-effort-pushes the config to the local helper server; stub it.
  server.use(
    http.post('http://127.0.0.1:8765/api/gist-config', () => HttpResponse.json({ ok: true })),
    http.delete('http://127.0.0.1:8765/api/gist-config', () => HttpResponse.json({ ok: true })),
  );
});

it('disables Save until a PAT is entered', async () => {
  const user = userEvent.setup();
  render(<OptionsApp />);

  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();

  await user.type(screen.getByLabelText(/Personal Access Token/), 'ghp_token');
  expect(save).toBeEnabled();
});

it('links to GitHub token creation with the gist scope pre-selected', () => {
  render(<OptionsApp />);
  const link = screen.getByRole('link', { name: /Create a token/ });
  expect(link).toHaveAttribute('href', expect.stringContaining('scopes=gist'));
});

it('creates a Gist when none is provided and none exists yet', async () => {
  const user = userEvent.setup();
  render(<OptionsApp />);

  await user.type(screen.getByLabelText(/Personal Access Token/), 'ghp_token');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(h.findGistWithData).toHaveBeenCalledWith('ghp_token');
  expect(h.createGist).toHaveBeenCalledWith('ghp_token');
  expect(h.setGistConfig).toHaveBeenCalledWith({ pat: 'ghp_token', gistId: 'new-gist-id' });
  expect(await screen.findByText(/Connected — gist:/)).toBeInTheDocument();
  expect(screen.getByText('new-gist-id')).toBeInTheDocument();
});

it('reuses an existing today-data.json gist instead of creating one', async () => {
  h.findGistWithData.mockResolvedValue('found-gist-id');
  const user = userEvent.setup();
  render(<OptionsApp />);

  await user.type(screen.getByLabelText(/Personal Access Token/), 'ghp_token');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(h.createGist).not.toHaveBeenCalled();
  expect(h.setGistConfig).toHaveBeenCalledWith({ pat: 'ghp_token', gistId: 'found-gist-id' });
  expect(await screen.findByText('found-gist-id')).toBeInTheDocument();
});

it('verifies an existing Gist id instead of creating one', async () => {
  const user = userEvent.setup();
  render(<OptionsApp />);

  await user.type(screen.getByLabelText(/Personal Access Token/), 'ghp_token');
  await user.type(screen.getByLabelText(/Gist ID/), 'existing-id');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(h.verifyGist).toHaveBeenCalledWith('ghp_token', 'existing-id');
  expect(h.createGist).not.toHaveBeenCalled();
  expect(h.findGistWithData).not.toHaveBeenCalled();
  expect(await screen.findByText(/Connected — gist:/)).toBeInTheDocument();
});

it('shows a scope hint when the PAT is rejected', async () => {
  h.findGistWithData.mockRejectedValue(new h.GistError('unauthorized', 401));
  const user = userEvent.setup();
  render(<OptionsApp />);

  await user.type(screen.getByLabelText(/Personal Access Token/), 'bad-token');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText(/check the PAT has gist scope/)).toBeInTheDocument();
  expect(h.setGistConfig).not.toHaveBeenCalled();
});

describe('S3 / R2 file uploads', () => {
  async function fillS3(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('S3 endpoint'), 'https://acc.r2.cloudflarestorage.com');
    await user.type(screen.getByLabelText('Bucket'), 'files');
    await user.type(screen.getByLabelText('Access key ID'), 'AKIA');
    await user.type(screen.getByLabelText('Secret access key'), 'secret');
    await user.type(screen.getByLabelText('Public base URL'), 'https://pub.r2.dev');
  }

  it('keeps Save disabled until every required field is filled', async () => {
    const user = userEvent.setup();
    render(<OptionsApp />);

    const save = screen.getByRole('button', { name: 'Save bucket' });
    expect(save).toBeDisabled();
    await fillS3(user);
    expect(save).toBeEnabled();
  });

  it('persists the bucket config on save', async () => {
    const user = userEvent.setup();
    render(<OptionsApp />);

    await fillS3(user);
    await user.click(screen.getByRole('button', { name: 'Save bucket' }));

    expect(h.setS3Config).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'files', publicBaseUrl: 'https://pub.r2.dev', region: 'auto' }),
    );
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('runs a probe upload and shows the resulting URL', async () => {
    const user = userEvent.setup();
    render(<OptionsApp />);

    await fillS3(user);
    await user.click(screen.getByRole('button', { name: 'Test upload' }));

    expect(h.testUpload).toHaveBeenCalled();
    expect(await screen.findByText(/Upload works/)).toBeInTheDocument();
  });

  it('surfaces an upload failure (e.g. CORS) from the probe', async () => {
    h.testUpload.mockRejectedValue(new Error('Upload failed (403 Forbidden). … CORS …'));
    const user = userEvent.setup();
    render(<OptionsApp />);

    await fillS3(user);
    await user.click(screen.getByRole('button', { name: 'Test upload' }));

    expect(await screen.findByText(/403 Forbidden/)).toBeInTheDocument();
  });
});

describe('existing config', () => {
  it('pre-fills the form and shows a Disconnect button', async () => {
    h.getGistConfig.mockResolvedValue({ pat: 'saved-tok', gistId: 'saved-id' });
    render(<OptionsApp />);

    expect(await screen.findByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    expect(screen.getByText('saved-id')).toBeInTheDocument();
  });
});
