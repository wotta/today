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
}));

import { OptionsApp } from '../entrypoints/options/OptionsApp';

beforeEach(() => {
  vi.clearAllMocks();
  h.findGistWithData.mockResolvedValue(null);
  h.createGist.mockResolvedValue('new-gist-id');
  h.getGistConfig.mockResolvedValue(null);
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

describe('existing config', () => {
  it('pre-fills the form and shows a Disconnect button', async () => {
    h.getGistConfig.mockResolvedValue({ pat: 'saved-tok', gistId: 'saved-id' });
    render(<OptionsApp />);

    expect(await screen.findByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    expect(screen.getByText('saved-id')).toBeInTheDocument();
  });
});
